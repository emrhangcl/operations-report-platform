begin;

alter table public.installation_assignments
  disable trigger installation_assignments_guard_update;

do $$
declare
  tunca_organization_id uuid;
  has_legacy_data boolean;
begin
  select
    exists (select 1 from public.profiles)
    or exists (select 1 from public.companies)
    or exists (select 1 from public.belts)
    or exists (select 1 from public.vehicles)
    or exists (select 1 from public.reports)
    or exists (select 1 from public.installation_assignments)
    or exists (select 1 from public.report_number_counters)
    or exists (select 1 from public.audit_logs)
  into has_legacy_data;

  if not has_legacy_data then
    return;
  end if;

  insert into public.organizations (name, slug, status)
  values ('TUNCA', 'tunca', 'active')
  on conflict (slug) do nothing;

  select id
    into strict tunca_organization_id
    from public.organizations
   where slug = 'tunca';

  update public.profiles
     set organization_id = tunca_organization_id
   where organization_id is null;

  insert into public.organization_members (
    organization_id,
    profile_id,
    role,
    is_active
  )
  select
    tunca_organization_id,
    profiles.id,
    case
      when profiles.role = 'ADMIN' then 'ADMIN'::public.organization_member_role
      else 'PERSONNEL'::public.organization_member_role
    end,
    profiles.is_active
  from public.profiles
  on conflict (organization_id, profile_id) do update
    set role = excluded.role,
        is_active = excluded.is_active,
        updated_at = now();

  update public.companies
     set organization_id = tunca_organization_id
   where organization_id is null;

  update public.belts
     set organization_id = tunca_organization_id
   where organization_id is null;

  update public.company_lines
     set organization_id = coalesce(
       (
         select companies.organization_id
           from public.companies
          where companies.id = company_lines.company_id
       ),
       tunca_organization_id
     )
   where organization_id is null;

  update public.vehicles
     set organization_id = tunca_organization_id
   where organization_id is null;

  update public.reports
     set organization_id = coalesce(
       (
         select profiles.organization_id
           from public.profiles
          where profiles.id = reports.created_by_user_id
       ),
       (
         select companies.organization_id
           from public.companies
          where companies.id = reports.company_id
       ),
       tunca_organization_id
     )
   where organization_id is null;

  update public.report_personnel
     set organization_id = reports.organization_id
    from public.reports
   where report_personnel.report_id = reports.id
     and report_personnel.organization_id is null;

  update public.report_process_types
     set organization_id = reports.organization_id
    from public.reports
   where report_process_types.report_id = reports.id
     and report_process_types.organization_id is null;

  update public.report_process_actions
     set organization_id = reports.organization_id
    from public.reports
   where report_process_actions.report_id = reports.id
     and report_process_actions.organization_id is null;

  update public.report_photos
     set organization_id = reports.organization_id
    from public.reports
   where report_photos.report_id = reports.id
     and report_photos.organization_id is null;

  update public.installation_assignments
     set organization_id = coalesce(
       (
         select reports.organization_id
           from public.reports
          where reports.id = installation_assignments.report_id
       ),
       (
         select profiles.organization_id
           from public.profiles
          where profiles.id = installation_assignments.assigned_to_profile_id
       ),
       (
         select companies.organization_id
           from public.companies
          where companies.id = installation_assignments.company_id
       ),
       tunca_organization_id
     )
   where organization_id is null;

  update public.report_number_counters
     set organization_id = tunca_organization_id
   where organization_id is null;

  update public.audit_logs
     set organization_id = coalesce(
       (
         select profiles.organization_id
           from public.profiles
          where profiles.id = audit_logs.actor_id
       ),
       tunca_organization_id
     )
   where organization_id is null;

  insert into public.subscriptions (
    organization_id,
    status,
    billing_interval,
    starts_at
  )
  select
    tunca_organization_id,
    'lifetime',
    'lifetime',
    now()
  where not exists (
    select 1
      from public.subscriptions
     where organization_id = tunca_organization_id
       and status = 'lifetime'
  );
end
$$;

alter table public.installation_assignments
  enable trigger installation_assignments_guard_update;

commit;
