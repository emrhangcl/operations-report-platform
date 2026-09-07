drop policy if exists profiles_select on public.profiles;
drop policy if exists profiles_insert_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;

create policy profiles_select on public.profiles
for select to authenticated
using (
  id = (select auth.uid())
  or (
    organization_id = private.current_organization_id()
    and private.is_organization_member(organization_id)
    and is_active
  )
  or (
    organization_id = private.current_organization_id()
    and private.is_admin()
  )
);

create policy profiles_insert_admin on public.profiles
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy profiles_update_admin on public.profiles
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
)
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

drop policy if exists companies_select on public.companies;
drop policy if exists companies_insert_admin on public.companies;
drop policy if exists companies_update_admin on public.companies;

create policy companies_select on public.companies
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and (private.is_admin() or (private.is_active_profile() and is_active))
);

create policy companies_insert_admin on public.companies
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy companies_update_admin on public.companies
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
)
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

drop policy if exists belts_select on public.belts;
drop policy if exists belts_insert_admin on public.belts;
drop policy if exists belts_update_admin on public.belts;

create policy belts_select on public.belts
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and (private.is_admin() or (private.is_active_profile() and is_active))
);

create policy belts_insert_admin on public.belts
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy belts_update_admin on public.belts
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
)
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

drop policy if exists company_lines_select on public.company_lines;
drop policy if exists company_lines_insert_admin on public.company_lines;
drop policy if exists company_lines_update_admin on public.company_lines;
drop policy if exists company_lines_delete_admin on public.company_lines;

create policy company_lines_select on public.company_lines
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_active_profile()
);

create policy company_lines_insert_admin on public.company_lines
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy company_lines_update_admin on public.company_lines
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
)
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy company_lines_delete_admin on public.company_lines
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

drop policy if exists vehicles_select on public.vehicles;
drop policy if exists vehicles_insert_admin on public.vehicles;
drop policy if exists vehicles_update_admin on public.vehicles;
drop policy if exists vehicles_delete_admin on public.vehicles;

create policy vehicles_select on public.vehicles
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_active_profile()
);

create policy vehicles_insert_admin on public.vehicles
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy vehicles_update_admin on public.vehicles
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
)
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy vehicles_delete_admin on public.vehicles
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

drop policy if exists reports_select on public.reports;
drop policy if exists reports_insert_active on public.reports;
drop policy if exists reports_update_owner_draft_or_admin on public.reports;

create policy reports_select on public.reports
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and (private.is_admin() or created_by_user_id = (select auth.uid()))
);

create policy reports_insert_active on public.reports
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_active_profile()
);

create policy reports_update_owner_draft_or_admin on public.reports
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (created_by_user_id = (select auth.uid()) and status = 'DRAFT'::public.report_status)
  )
)
with check (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or created_by_user_id = (select auth.uid())
  )
);

drop policy if exists installation_assignments_select on public.installation_assignments;
drop policy if exists installation_assignments_insert_admin on public.installation_assignments;
drop policy if exists installation_assignments_update_admin_or_assignee on public.installation_assignments;
drop policy if exists installation_assignments_delete_admin on public.installation_assignments;

create policy installation_assignments_select on public.installation_assignments
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (private.is_active_profile() and assigned_to_profile_id = (select auth.uid()))
  )
);

create policy installation_assignments_insert_admin on public.installation_assignments
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy installation_assignments_update_admin_or_assignee on public.installation_assignments
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (
      private.is_active_profile()
      and assigned_to_profile_id = (select auth.uid())
      and status in ('ASSIGNED'::public.installation_assignment_status, 'IN_PROGRESS'::public.installation_assignment_status)
    )
  )
)
with check (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (
      private.is_active_profile()
      and assigned_to_profile_id = (select auth.uid())
      and status in ('ASSIGNED'::public.installation_assignment_status, 'IN_PROGRESS'::public.installation_assignment_status, 'COMPLETED'::public.installation_assignment_status)
    )
  )
);

create policy installation_assignments_delete_admin on public.installation_assignments
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
);;
