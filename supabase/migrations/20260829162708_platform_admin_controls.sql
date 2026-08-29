begin;

-- Platform administrators are authenticated users, not tenant administrators.
alter table public.audit_logs
  drop constraint if exists audit_logs_actor_id_fkey;

alter table public.audit_logs
  add constraint audit_logs_actor_id_fkey
  foreign key (actor_id) references auth.users(id) on delete set null not valid;

create or replace function public.is_platform_admin_for_user(candidate_user_id uuid)
returns boolean
language sql
security definer
set search_path = private
stable
as $$
  select private.is_platform_admin(candidate_user_id);
$$;

create or replace function public.platform_dashboard_metrics()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with current_subscriptions as (
    select subscriptions.*, plans.name as plan_name, plans.monthly_price_minor, plans.yearly_price_minor
      from public.subscriptions
      left join public.plans on plans.id = subscriptions.plan_id
     where subscriptions.is_current
  ),
  plan_distribution as (
    select coalesce(plan_name, 'Paket seçilmedi') as plan_name, count(*)::bigint as organization_count
      from current_subscriptions
     group by coalesce(plan_name, 'Paket seçilmedi')
     order by organization_count desc, plan_name
  )
  select jsonb_build_object(
    'total_organizations', (select count(*) from public.organizations),
    'active_subscriptions', (select count(*) from current_subscriptions where status = 'active'),
    'monthly_subscriptions', (select count(*) from current_subscriptions where billing_interval = 'monthly'),
    'yearly_subscriptions', (select count(*) from current_subscriptions where billing_interval = 'yearly'),
    'lifetime_subscriptions', (select count(*) from current_subscriptions where status = 'lifetime'),
    'pending_payments', (select count(*) from public.payments where status = 'pending'),
    'failed_renewals', (select count(*) from public.payments where status = 'failed'),
    'canceled_subscriptions', (select count(*) from current_subscriptions where status = 'canceled'),
    'grace_period_accounts', (select count(*) from current_subscriptions where status = 'grace_period'),
    'read_only_accounts', (select count(*) from current_subscriptions where status = 'read_only'),
    'mrr_minor', (
      select coalesce(round(sum(case
        when billing_interval = 'monthly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(monthly_price_minor, 0)::numeric
        when billing_interval = 'yearly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(yearly_price_minor, 0)::numeric / 12
        else 0
      end)), 0)::bigint
        from current_subscriptions
    ),
    'arr_minor', (
      select coalesce(sum(case
        when billing_interval = 'monthly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(monthly_price_minor, 0) * 12
        when billing_interval = 'yearly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(yearly_price_minor, 0)
        else 0
      end), 0)::bigint
        from current_subscriptions
    ),
    'successful_collected_minor', (
      select coalesce(sum(amount_minor), 0)::bigint
        from public.payments
       where status = 'succeeded'
    ),
    'refunded_total_minor', (
      select coalesce(sum(refunded_amount_minor), 0)::bigint
        from public.payments
    ),
    'new_organizations_30d', (
      select count(*)
        from public.organizations
       where created_at >= now() - interval '30 days'
    ),
    'active_users', (
      select count(*)
        from public.profiles
        join public.organizations on organizations.id = profiles.organization_id
       where profiles.is_active
         and organizations.status = 'active'
    ),
    'payment_error_count', (
      select count(*)
        from public.payment_events
       where processing_error is not null
    ),
    'last_successful_backup_at', null::timestamptz,
    'plan_distribution', coalesce((select jsonb_agg(to_jsonb(plan_distribution)) from plan_distribution), '[]'::jsonb)
  );
$$;

create or replace function public.platform_set_organization_status(
  target_organization_id uuid,
  target_status public.organization_status,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_organization public.organizations%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;

  select *
    into target_organization
    from public.organizations
   where id = target_organization_id
   for update;

  if not found then
    raise exception 'Organization was not found.' using errcode = 'P0002';
  end if;

  if target_organization.status = 'closed' and target_status <> 'closed' then
    raise exception 'A closed organization cannot be reopened by this operation.' using errcode = '22023';
  end if;

  update public.organizations
     set status = target_status,
         closed_at = case when target_status = 'closed' then coalesce(closed_at, now()) else closed_at end
   where id = target_organization_id;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  ) values (
    target_organization_id,
    actor_user_id,
    case target_status
      when 'active' then 'platform_organization_activated'
      when 'suspended' then 'platform_organization_suspended'
      else 'platform_organization_closure_started'
    end,
    'organizations',
    target_organization_id,
    jsonb_build_object('status', target_organization.status),
    jsonb_build_object('status', target_status)
  );

  return jsonb_build_object('organization_id', target_organization_id, 'status', target_status);
end;
$$;

create or replace function public.platform_set_lifetime(
  target_organization_id uuid,
  enable_lifetime boolean,
  target_plan_id uuid,
  target_billing_interval public.billing_interval,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_organization public.organizations%rowtype;
  selected_subscription public.subscriptions%rowtype;
  before_status public.subscription_status;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;

  select *
    into target_organization
    from public.organizations
   where id = target_organization_id
   for update;

  if not found then
    raise exception 'Organization was not found.' using errcode = 'P0002';
  end if;

  if target_organization.status = 'closed' then
    raise exception 'A closed organization cannot be changed.' using errcode = '22023';
  end if;

  select *
    into selected_subscription
    from public.subscriptions
   where organization_id = target_organization_id
     and is_current
   for update;

  if enable_lifetime then
    if selected_subscription.id is null then
      insert into public.subscriptions (
        organization_id,
        status,
        billing_interval,
        starts_at
      ) values (
        target_organization_id,
        'lifetime'::public.subscription_status,
        'lifetime'::public.billing_interval,
        now()
      )
      returning * into selected_subscription;
    else
      before_status = selected_subscription.status;
      update public.subscriptions
         set plan_id = null,
             status = 'lifetime'::public.subscription_status,
             billing_interval = 'lifetime'::public.billing_interval,
             provider = null,
             provider_customer_id = null,
             provider_subscription_id = null,
             starts_at = coalesce(starts_at, now()),
             current_period_starts_at = null,
             current_period_ends_at = null,
             grace_period_ends_at = null,
             canceled_at = null
       where id = selected_subscription.id;
    end if;

    update public.organizations
       set status = 'active'::public.organization_status
     where id = target_organization_id;

    insert into public.audit_logs (
      organization_id, actor_id, action, entity_table, entity_id, before_data, after_data
    ) values (
      target_organization_id,
      actor_user_id,
      'platform_lifetime_granted',
      'subscriptions',
      selected_subscription.id,
      jsonb_build_object('status', coalesce(before_status::text, 'none')),
      jsonb_build_object('status', 'lifetime', 'transferable', false)
    );

    return jsonb_build_object('organization_id', target_organization_id, 'status', 'lifetime');
  end if;

  if target_plan_id is null or target_billing_interval not in ('monthly', 'yearly') then
    raise exception 'A monthly or yearly plan is required when lifetime access is removed.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.plans where id = target_plan_id and is_active
  ) then
    raise exception 'The selected plan is not available.' using errcode = '22023';
  end if;

  if selected_subscription.id is null then
    insert into public.subscriptions (
      organization_id, plan_id, status, billing_interval
    ) values (
      target_organization_id,
      target_plan_id,
      'pending'::public.subscription_status,
      target_billing_interval
    )
    returning * into selected_subscription;
  else
    before_status = selected_subscription.status;
    update public.subscriptions
       set plan_id = target_plan_id,
           status = 'pending'::public.subscription_status,
           billing_interval = target_billing_interval,
           provider = null,
           provider_customer_id = null,
           provider_subscription_id = null,
           starts_at = null,
           current_period_starts_at = null,
           current_period_ends_at = null,
           grace_period_ends_at = null,
           canceled_at = null
     where id = selected_subscription.id;
  end if;

  update public.organizations
     set status = 'suspended'::public.organization_status
   where id = target_organization_id;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_table, entity_id, before_data, after_data
  ) values (
    target_organization_id,
    actor_user_id,
    'platform_lifetime_removed',
    'subscriptions',
    selected_subscription.id,
    jsonb_build_object('status', coalesce(before_status::text, 'lifetime')),
    jsonb_build_object('status', 'pending', 'billing_interval', target_billing_interval, 'plan_id', target_plan_id)
  );

  return jsonb_build_object('organization_id', target_organization_id, 'status', 'pending');
end;
$$;

create or replace function public.platform_change_plan(
  target_organization_id uuid,
  target_plan_id uuid,
  target_billing_interval public.billing_interval,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  target_organization public.organizations%rowtype;
  selected_subscription public.subscriptions%rowtype;
  selected_plan public.plans%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;

  if target_billing_interval not in ('monthly', 'yearly') then
    raise exception 'Only monthly and yearly plans can be assigned.' using errcode = '22023';
  end if;

  select * into target_organization from public.organizations where id = target_organization_id for update;
  if not found then
    raise exception 'Organization was not found.' using errcode = 'P0002';
  end if;
  if target_organization.status = 'closed' then
    raise exception 'A closed organization cannot be changed.' using errcode = '22023';
  end if;

  select * into selected_plan from public.plans where id = target_plan_id and is_active;
  if not found then
    raise exception 'The selected plan is not available.' using errcode = '22023';
  end if;

  select *
    into selected_subscription
    from public.subscriptions
   where organization_id = target_organization_id
     and is_current
   for update;

  if selected_subscription.id is null then
    insert into public.subscriptions (
      organization_id, plan_id, status, billing_interval
    ) values (
      target_organization_id, target_plan_id, 'pending', target_billing_interval
    )
    returning * into selected_subscription;
  else
    update public.subscriptions
       set plan_id = target_plan_id,
           status = 'pending'::public.subscription_status,
           billing_interval = target_billing_interval,
           provider = null,
           provider_customer_id = null,
           provider_subscription_id = null,
           starts_at = null,
           current_period_starts_at = null,
           current_period_ends_at = null,
           grace_period_ends_at = null,
           canceled_at = null
     where id = selected_subscription.id;
  end if;

  update public.organizations
     set status = 'suspended'::public.organization_status
   where id = target_organization_id;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_table, entity_id, after_data
  ) values (
    target_organization_id,
    actor_user_id,
    'platform_plan_changed',
    'subscriptions',
    selected_subscription.id,
    jsonb_build_object('status', 'pending', 'plan_id', selected_plan.id, 'billing_interval', target_billing_interval)
  );

  return jsonb_build_object(
    'organization_id', target_organization_id,
    'status', 'pending',
    'plan_id', selected_plan.id,
    'billing_interval', target_billing_interval
  );
end;
$$;

revoke execute on function public.is_platform_admin_for_user(uuid) from public, anon, authenticated;
revoke execute on function public.platform_dashboard_metrics() from public, anon, authenticated;
revoke execute on function public.platform_set_organization_status(uuid, public.organization_status, uuid)
  from public, anon, authenticated;
revoke execute on function public.platform_set_lifetime(uuid, boolean, uuid, public.billing_interval, uuid)
  from public, anon, authenticated;
revoke execute on function public.platform_change_plan(uuid, uuid, public.billing_interval, uuid)
  from public, anon, authenticated;

grant execute on function public.is_platform_admin_for_user(uuid) to service_role;
grant execute on function public.platform_dashboard_metrics() to service_role;
grant execute on function public.platform_set_organization_status(uuid, public.organization_status, uuid)
  to service_role;
grant execute on function public.platform_set_lifetime(uuid, boolean, uuid, public.billing_interval, uuid)
  to service_role;
grant execute on function public.platform_change_plan(uuid, uuid, public.billing_interval, uuid)
  to service_role;

commit;
