begin;

alter table public.subscriptions
  add column if not exists is_current boolean;

with ranked_subscriptions as (
  select
    id,
    row_number() over (
      partition by organization_id
      order by
        case when status = 'lifetime' then 0 else 1 end,
        created_at desc,
        id desc
    ) as row_number
  from public.subscriptions
)
update public.subscriptions
   set is_current = ranked_subscriptions.row_number = 1
  from ranked_subscriptions
 where subscriptions.id = ranked_subscriptions.id
   and subscriptions.is_current is null;

update public.subscriptions
   set is_current = true
 where is_current is null;

alter table public.subscriptions
  alter column is_current set default true,
  alter column is_current set not null;

create unique index if not exists subscriptions_one_current_per_organization_idx
  on public.subscriptions (organization_id)
  where is_current;

create unique index if not exists payments_provider_external_payment_unique_idx
  on public.payments (provider, external_payment_id)
  where external_payment_id is not null;

create or replace function private.subscription_access_mode(
  target_organization_id uuid,
  evaluated_at timestamptz default now()
)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select case
    when organizations.status <> 'active' then 'blocked'
    when subscriptions.status = 'lifetime' then 'write'
    when subscriptions.status = 'active'
      and (
        subscriptions.current_period_ends_at is null
        or subscriptions.current_period_ends_at > evaluated_at
      ) then 'write'
    when subscriptions.status = 'active'
      and evaluated_at < coalesce(
        subscriptions.grace_period_ends_at,
        subscriptions.current_period_ends_at + interval '7 days'
      ) then 'write'
    when subscriptions.status in ('past_due', 'grace_period')
      and evaluated_at < coalesce(
        subscriptions.grace_period_ends_at,
        subscriptions.updated_at + interval '7 days'
      ) then 'write'
    when subscriptions.status in ('active', 'past_due', 'grace_period', 'read_only') then 'read'
    else 'blocked'
  end
    from public.organizations
    left join public.subscriptions
      on subscriptions.organization_id = organizations.id
     and subscriptions.is_current
   where organizations.id = target_organization_id
   limit 1;
$$;

create or replace function private.has_application_read_access(
  target_organization_id uuid,
  evaluated_at timestamptz default now()
)
returns boolean
language sql
security definer
set search_path = private
stable
as $$
  select private.is_organization_member(target_organization_id)
    and coalesce(private.subscription_access_mode(target_organization_id, evaluated_at), 'blocked')
      in ('read', 'write');
$$;

create or replace function private.has_application_write_access(
  target_organization_id uuid,
  evaluated_at timestamptz default now()
)
returns boolean
language sql
security definer
set search_path = private
stable
as $$
  select private.is_organization_member(target_organization_id)
    and coalesce(private.subscription_access_mode(target_organization_id, evaluated_at), 'blocked') = 'write';
$$;

create or replace function private.entitlement(
  target_organization_id uuid,
  entitlement_code text
)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  with selected_entitlement as (
    select entitlements.enabled, entitlements.value, 0 as priority
      from public.entitlements
     where entitlements.organization_id = target_organization_id
       and entitlements.code = entitlement_code
    union all
    select entitlements.enabled, entitlements.value, 1 as priority
      from public.subscriptions
      join public.entitlements
        on entitlements.plan_id = subscriptions.plan_id
     where subscriptions.organization_id = target_organization_id
       and subscriptions.is_current
       and entitlements.code = entitlement_code
  )
  select jsonb_build_object('enabled', enabled, 'value', value)
    from selected_entitlement
   order by priority
   limit 1;
$$;

create or replace function private.has_entitlement(
  target_organization_id uuid,
  entitlement_code text
)
returns boolean
language sql
security definer
set search_path = private
stable
as $$
  select coalesce((private.entitlement(target_organization_id, entitlement_code) ->> 'enabled')::boolean, false);
$$;

revoke execute on function private.subscription_access_mode(uuid, timestamptz) from public, anon;
revoke execute on function private.has_application_read_access(uuid, timestamptz) from public, anon;
revoke execute on function private.has_application_write_access(uuid, timestamptz) from public, anon;
revoke execute on function private.entitlement(uuid, text) from public, anon;
revoke execute on function private.has_entitlement(uuid, text) from public, anon;

grant execute on function private.subscription_access_mode(uuid, timestamptz) to authenticated, service_role;
grant execute on function private.has_application_read_access(uuid, timestamptz) to authenticated, service_role;
grant execute on function private.has_application_write_access(uuid, timestamptz) to authenticated, service_role;
grant execute on function private.entitlement(uuid, text) to authenticated, service_role;
grant execute on function private.has_entitlement(uuid, text) to authenticated, service_role;

create or replace function public.reconcile_organization_subscription(
  target_organization_id uuid,
  evaluated_at timestamptz default now()
)
returns public.subscription_status
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_subscription public.subscriptions%rowtype;
  next_status public.subscription_status;
  next_grace_period_ends_at timestamptz;
begin
  select *
    into selected_subscription
    from public.subscriptions
   where organization_id = target_organization_id
     and is_current
   for update;

  if selected_subscription.id is null then
    return null;
  end if;

  next_status = selected_subscription.status;
  next_grace_period_ends_at = selected_subscription.grace_period_ends_at;

  if selected_subscription.status = 'active'
    and selected_subscription.current_period_ends_at is not null
    and selected_subscription.current_period_ends_at <= evaluated_at then
    next_grace_period_ends_at = coalesce(
      selected_subscription.grace_period_ends_at,
      selected_subscription.current_period_ends_at + interval '7 days'
    );
    next_status = case
      when next_grace_period_ends_at > evaluated_at then 'grace_period'::public.subscription_status
      else 'read_only'::public.subscription_status
    end;
  elsif selected_subscription.status = 'past_due' then
    next_grace_period_ends_at = coalesce(
      selected_subscription.grace_period_ends_at,
      selected_subscription.updated_at + interval '7 days'
    );
    next_status = case
      when next_grace_period_ends_at > evaluated_at then 'grace_period'::public.subscription_status
      else 'read_only'::public.subscription_status
    end;
  elsif selected_subscription.status = 'grace_period'
    and coalesce(selected_subscription.grace_period_ends_at, evaluated_at) <= evaluated_at then
    next_status = 'read_only';
  end if;

  if next_status is distinct from selected_subscription.status
    or next_grace_period_ends_at is distinct from selected_subscription.grace_period_ends_at then
    update public.subscriptions
       set status = next_status,
           grace_period_ends_at = next_grace_period_ends_at
     where id = selected_subscription.id;
  end if;

  if next_status in ('active', 'past_due', 'grace_period', 'read_only', 'lifetime') then
    update public.organizations
       set status = 'active'
     where id = target_organization_id
       and status <> 'closed';
  end if;

  return next_status;
end;
$$;

revoke execute on function public.reconcile_organization_subscription(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.reconcile_organization_subscription(uuid, timestamptz)
  to service_role;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (
    private.has_application_read_access(organization_id)
    and organization_id = private.current_organization_id()
    and (
      private.has_organization_role(
        organization_id,
        array['OWNER', 'ADMIN']::public.organization_member_role[]
      )
      or (private.is_active_organization_member(organization_id) and is_active)
    )
  )
);

drop policy if exists subscription_write_access on public.profiles;
create policy subscription_write_access on public.profiles
as restrictive
for update
to authenticated
using (private.has_application_write_access(organization_id))
with check (private.has_application_write_access(organization_id));

do $$
declare
  protected_table text;
begin
  foreach protected_table in array array[
    'companies',
    'belts',
    'company_lines',
    'vehicles',
    'reports',
    'report_personnel',
    'report_process_types',
    'report_process_actions',
    'report_photos',
    'installation_assignments',
    'audit_logs'
  ] loop
    execute format('drop policy if exists subscription_read_access on public.%I', protected_table);
    execute format(
      'create policy subscription_read_access on public.%I as restrictive for select to authenticated using (private.has_application_read_access(organization_id))',
      protected_table
    );
  end loop;

  foreach protected_table in array array[
    'companies',
    'belts',
    'company_lines',
    'vehicles',
    'reports',
    'report_personnel',
    'report_process_types',
    'report_process_actions',
    'report_photos',
    'installation_assignments'
  ] loop
    execute format('drop policy if exists subscription_insert_access on public.%I', protected_table);
    execute format(
      'create policy subscription_insert_access on public.%I as restrictive for insert to authenticated with check (private.has_application_write_access(organization_id))',
      protected_table
    );
    execute format('drop policy if exists subscription_update_access on public.%I', protected_table);
    execute format(
      'create policy subscription_update_access on public.%I as restrictive for update to authenticated using (private.has_application_write_access(organization_id)) with check (private.has_application_write_access(organization_id))',
      protected_table
    );
    execute format('drop policy if exists subscription_delete_access on public.%I', protected_table);
    execute format(
      'create policy subscription_delete_access on public.%I as restrictive for delete to authenticated using (private.has_application_write_access(organization_id))',
      protected_table
    );
  end loop;
end
$$;

create or replace function private.storage_organization_id(object_name text)
returns uuid
language plpgsql
security invoker
set search_path = storage
immutable
as $$
declare
  organization_segment text;
begin
  organization_segment = (storage.foldername(object_name))[1];

  if organization_segment is null
    or organization_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return organization_segment::uuid;
end;
$$;

revoke execute on function private.storage_organization_id(text) from public, anon;
grant execute on function private.storage_organization_id(text) to authenticated, service_role;

drop policy if exists subscription_read_access on storage.objects;
create policy subscription_read_access on storage.objects
as restrictive
for select
to authenticated
using (
  bucket_id <> 'report-photos'
  or private.has_application_read_access(private.storage_organization_id(name))
);

drop policy if exists subscription_insert_access on storage.objects;
create policy subscription_insert_access on storage.objects
as restrictive
for insert
to authenticated
with check (
  bucket_id <> 'report-photos'
  or private.has_application_write_access(private.storage_organization_id(name))
);

drop policy if exists subscription_delete_access on storage.objects;
create policy subscription_delete_access on storage.objects
as restrictive
for delete
to authenticated
using (
  bucket_id <> 'report-photos'
  or private.has_application_write_access(private.storage_organization_id(name))
);

commit;
