begin;

create or replace function public.get_user_access_context(
  candidate_user_id uuid,
  evaluated_at timestamptz default now()
)
returns table (
  organization_id uuid,
  organization_name text,
  organization_logo_path text,
  profile_is_active boolean,
  member_role text,
  membership_is_active boolean,
  organization_status text,
  subscription_status text,
  billing_interval text,
  current_period_ends_at timestamptz,
  grace_period_ends_at timestamptz,
  subscription_updated_at timestamptz,
  access_mode text
)
language sql
security definer
set search_path = ''
stable
as $$
  select
    profiles.organization_id,
    organizations.name,
    organizations.logo_path,
    profiles.is_active,
    organization_members.role::text,
    organization_members.is_active,
    organizations.status::text,
    subscriptions.status::text,
    subscriptions.billing_interval::text,
    subscriptions.current_period_ends_at,
    subscriptions.grace_period_ends_at,
    subscriptions.updated_at,
    case
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
  from public.profiles
  join public.organizations
    on organizations.id = profiles.organization_id
  left join public.organization_members
    on organization_members.organization_id = profiles.organization_id
   and organization_members.profile_id = profiles.id
  left join public.subscriptions
    on subscriptions.organization_id = profiles.organization_id
   and subscriptions.is_current
  where profiles.id = candidate_user_id
  limit 1;
$$;

revoke execute on function public.get_user_access_context(uuid, timestamptz)
  from public, anon, authenticated;
grant execute on function public.get_user_access_context(uuid, timestamptz)
  to service_role;

commit;
