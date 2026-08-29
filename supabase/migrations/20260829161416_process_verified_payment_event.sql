begin;

create or replace function public.process_verified_payment_event(
  p_provider text,
  p_external_event_id text,
  p_event_type text,
  p_provider_customer_id text,
  p_provider_subscription_id text,
  p_external_payment_id text,
  p_amount_minor bigint,
  p_currency text,
  p_occurred_at timestamptz,
  p_period_start_at timestamptz,
  p_period_end_at timestamptz,
  p_payload_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_subscription public.subscriptions%rowtype;
  selected_plan public.plans%rowtype;
  existing_event public.payment_events%rowtype;
  existing_payment public.payments%rowtype;
  event_id uuid;
  linked_payment_id uuid;
  normalized_currency text;
  expected_amount bigint;
  next_period_start timestamptz;
  next_period_end timestamptz;
  next_refunded_amount bigint;
begin
  if p_provider not in ('iyzico', 'paytr') then
    raise exception 'Unsupported payment provider.' using errcode = '22023';
  end if;

  if p_external_event_id is null or length(btrim(p_external_event_id)) not between 1 and 180 then
    raise exception 'Invalid external event id.' using errcode = '22023';
  end if;

  if p_event_type not in (
    'payment.succeeded',
    'payment.failed',
    'payment.refunded',
    'subscription.canceled'
  ) then
    raise exception 'Unsupported payment event type.' using errcode = '22023';
  end if;

  if p_provider_subscription_id is null
    or length(btrim(p_provider_subscription_id)) not between 1 and 180 then
    raise exception 'Payment subscription reference is required.' using errcode = '22023';
  end if;

  if p_occurred_at is null then
    raise exception 'Payment event time is required.' using errcode = '22023';
  end if;

  if p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid payment payload hash.' using errcode = '22023';
  end if;

  select *
    into selected_subscription
    from public.subscriptions
   where provider = p_provider
     and provider_subscription_id = btrim(p_provider_subscription_id)
     and is_current
   for update;

  if not found then
    raise exception 'Payment subscription reference was not found.' using errcode = 'P0002';
  end if;

  if p_event_type in ('payment.succeeded', 'payment.failed', 'payment.refunded') then
    if p_external_payment_id is null or length(btrim(p_external_payment_id)) not between 1 and 180 then
      raise exception 'Payment reference is required.' using errcode = '22023';
    end if;

    if p_amount_minor is null or p_amount_minor < 0 then
      raise exception 'Payment amount is invalid.' using errcode = '22023';
    end if;

    if p_currency is null or upper(btrim(p_currency)) !~ '^[A-Z]{3}$' then
      raise exception 'Payment currency is invalid.' using errcode = '22023';
    end if;

    normalized_currency = upper(btrim(p_currency));
  end if;

  if p_event_type = 'payment.succeeded' then
    if selected_subscription.plan_id is null then
      raise exception 'A plan is required before a payment can activate a subscription.' using errcode = '22023';
    end if;

    select *
      into selected_plan
      from public.plans
     where id = selected_subscription.plan_id;

    if not found or not selected_plan.is_active then
      raise exception 'The subscription plan is not available.' using errcode = '22023';
    end if;

    expected_amount = case selected_subscription.billing_interval
      when 'monthly' then selected_plan.monthly_price_minor
      when 'yearly' then selected_plan.yearly_price_minor
      else null
    end;

    if expected_amount is null
      or expected_amount <> p_amount_minor
      or selected_plan.currency <> normalized_currency then
      raise exception 'Payment amount or currency does not match the subscription plan.' using errcode = '22023';
    end if;
  end if;

  insert into public.payment_events (
    organization_id,
    provider,
    external_event_id,
    event_type,
    signature_verified,
    payload_hash,
    processed_at
  ) values (
    selected_subscription.organization_id,
    p_provider,
    btrim(p_external_event_id),
    p_event_type,
    true,
    p_payload_hash,
    clock_timestamp()
  )
  on conflict (provider, external_event_id) do nothing
  returning id into event_id;

  if event_id is null then
    select *
      into existing_event
      from public.payment_events
     where provider = p_provider
       and external_event_id = btrim(p_external_event_id)
     for update;

    if existing_event.payload_hash <> p_payload_hash then
      raise exception 'Payment webhook replay payload does not match.' using errcode = '23514';
    end if;

    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', existing_event.payment_id
    );
  end if;

  if p_event_type in ('payment.succeeded', 'payment.failed') then
    select *
      into existing_payment
      from public.payments
     where provider = p_provider
       and external_payment_id = btrim(p_external_payment_id)
     for update;

    if found then
      if existing_payment.organization_id <> selected_subscription.organization_id
        or (
          existing_payment.subscription_id is not null
          and existing_payment.subscription_id <> selected_subscription.id
        ) then
        raise exception 'Payment reference belongs to another subscription.' using errcode = '23514';
      end if;

      linked_payment_id = existing_payment.id;
    end if;
  end if;

  if p_event_type = 'payment.succeeded' then
    if existing_payment.id is not null and existing_payment.status = 'succeeded' then
      update public.payment_events
         set payment_id = existing_payment.id
       where id = event_id;

      return jsonb_build_object(
        'applied', false,
        'duplicate_payment', true,
        'organization_id', selected_subscription.organization_id,
        'payment_id', existing_payment.id
      );
    end if;

    if existing_payment.id is null then
      insert into public.payments (
        organization_id,
        subscription_id,
        provider,
        external_payment_id,
        status,
        amount_minor,
        currency,
        paid_at
      ) values (
        selected_subscription.organization_id,
        selected_subscription.id,
        p_provider,
        btrim(p_external_payment_id),
        'succeeded'::public.payment_status,
        p_amount_minor,
        normalized_currency,
        p_occurred_at
      )
      returning id into linked_payment_id;
    else
      update public.payments
         set subscription_id = selected_subscription.id,
             status = 'succeeded'::public.payment_status,
             amount_minor = p_amount_minor,
             currency = normalized_currency,
             paid_at = p_occurred_at
       where id = existing_payment.id;
    end if;

    if selected_subscription.billing_interval = 'lifetime' then
      update public.subscriptions
         set status = 'lifetime'::public.subscription_status,
             current_period_starts_at = null,
             current_period_ends_at = null,
             grace_period_ends_at = null,
             canceled_at = null
       where id = selected_subscription.id;
    else
      next_period_start = coalesce(
        p_period_start_at,
        selected_subscription.current_period_starts_at,
        p_occurred_at
      );
      next_period_end = p_period_end_at;

      if next_period_end is null then
        next_period_end = case selected_subscription.billing_interval
          when 'monthly' then next_period_start + interval '1 month'
          when 'yearly' then next_period_start + interval '1 year'
          else null
        end;
      end if;

      if next_period_end is null or next_period_end <= next_period_start then
        raise exception 'Payment period is invalid.' using errcode = '22023';
      end if;

      if selected_subscription.current_period_ends_at is not null
        and next_period_end <= selected_subscription.current_period_ends_at then
        next_period_start = coalesce(
          selected_subscription.current_period_starts_at,
          next_period_start
        );
        next_period_end = selected_subscription.current_period_ends_at;
      end if;

      update public.subscriptions
         set status = 'active'::public.subscription_status,
             starts_at = coalesce(starts_at, p_occurred_at),
             current_period_starts_at = next_period_start,
             current_period_ends_at = next_period_end,
             grace_period_ends_at = null,
             canceled_at = null
       where id = selected_subscription.id;
    end if;

    update public.organizations
       set status = 'active'::public.organization_status
     where id = selected_subscription.organization_id
       and status <> 'closed'::public.organization_status;

    update public.payment_events
       set payment_id = linked_payment_id
     where id = event_id;

    return jsonb_build_object(
      'applied', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', linked_payment_id,
      'subscription_status', case
        when selected_subscription.billing_interval = 'lifetime' then 'lifetime'
        else 'active'
      end
    );
  end if;

  if p_event_type = 'payment.failed' then
    if existing_payment.id is not null and existing_payment.status = 'succeeded' then
      update public.payment_events
         set payment_id = existing_payment.id
       where id = event_id;

      return jsonb_build_object(
        'applied', false,
        'payment_already_succeeded', true,
        'organization_id', selected_subscription.organization_id,
        'payment_id', existing_payment.id
      );
    end if;

    if existing_payment.id is null then
      insert into public.payments (
        organization_id,
        subscription_id,
        provider,
        external_payment_id,
        status,
        amount_minor,
        currency
      ) values (
        selected_subscription.organization_id,
        selected_subscription.id,
        p_provider,
        btrim(p_external_payment_id),
        'failed'::public.payment_status,
        p_amount_minor,
        normalized_currency
      )
      returning id into linked_payment_id;
    else
      update public.payments
         set subscription_id = selected_subscription.id,
             status = 'failed'::public.payment_status,
             amount_minor = p_amount_minor,
             currency = normalized_currency,
             paid_at = null
       where id = existing_payment.id;
    end if;

    if selected_subscription.status <> 'lifetime'::public.subscription_status
      and selected_subscription.status <> 'canceled'::public.subscription_status then
      update public.subscriptions
         set status = 'past_due'::public.subscription_status,
             grace_period_ends_at = coalesce(
               grace_period_ends_at,
               p_occurred_at + interval '7 days'
             )
       where id = selected_subscription.id;
    end if;

    update public.payment_events
       set payment_id = linked_payment_id
     where id = event_id;

    return jsonb_build_object(
      'applied', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', linked_payment_id,
      'subscription_status', 'past_due'
    );
  end if;

  if p_event_type = 'payment.refunded' then
    select *
      into existing_payment
      from public.payments
     where provider = p_provider
       and external_payment_id = btrim(p_external_payment_id)
     for update;

    if not found then
      raise exception 'Refund payment reference was not found.' using errcode = 'P0002';
    end if;

    if existing_payment.organization_id <> selected_subscription.organization_id
      or existing_payment.subscription_id is distinct from selected_subscription.id then
      raise exception 'Refund payment belongs to another subscription.' using errcode = '23514';
    end if;

    if existing_payment.currency <> normalized_currency
      or p_amount_minor <= 0
      or existing_payment.refunded_amount_minor + p_amount_minor > existing_payment.amount_minor then
      raise exception 'Refund amount or currency is invalid.' using errcode = '22023';
    end if;

    next_refunded_amount = existing_payment.refunded_amount_minor + p_amount_minor;
    update public.payments
       set refunded_amount_minor = next_refunded_amount,
           status = case
             when next_refunded_amount = amount_minor then 'refunded'::public.payment_status
             else status
           end
     where id = existing_payment.id;

    if next_refunded_amount = existing_payment.amount_minor
      and selected_subscription.status <> 'lifetime'::public.subscription_status
      and selected_subscription.status <> 'canceled'::public.subscription_status then
      update public.subscriptions
         set status = 'past_due'::public.subscription_status,
             grace_period_ends_at = coalesce(
               grace_period_ends_at,
               p_occurred_at + interval '7 days'
             )
       where id = selected_subscription.id;
    end if;

    update public.payment_events
       set payment_id = existing_payment.id
     where id = event_id;

    return jsonb_build_object(
      'applied', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', existing_payment.id,
      'refunded_amount_minor', next_refunded_amount
    );
  end if;

  update public.subscriptions
     set status = 'canceled'::public.subscription_status,
         canceled_at = coalesce(canceled_at, p_occurred_at)
   where id = selected_subscription.id;

  update public.organizations
     set status = 'suspended'::public.organization_status
   where id = selected_subscription.organization_id
     and status <> 'closed'::public.organization_status;

  return jsonb_build_object(
    'applied', true,
    'organization_id', selected_subscription.organization_id,
    'subscription_status', 'canceled'
  );
end;
$$;

revoke execute on function public.process_verified_payment_event(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  timestamp with time zone,
  timestamp with time zone,
  timestamp with time zone,
  text
) from public, anon, authenticated;

grant execute on function public.process_verified_payment_event(
  text,
  text,
  text,
  text,
  text,
  text,
  bigint,
  text,
  timestamp with time zone,
  timestamp with time zone,
  timestamp with time zone,
  text
) to service_role;

commit;
