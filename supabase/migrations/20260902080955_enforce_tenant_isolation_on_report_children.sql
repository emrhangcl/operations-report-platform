drop policy if exists report_personnel_select on public.report_personnel;
drop policy if exists report_personnel_insert_owner_or_admin on public.report_personnel;
drop policy if exists report_personnel_delete_owner_or_admin on public.report_personnel;

create policy report_personnel_select on public.report_personnel
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_personnel_insert_owner_or_admin on public.report_personnel
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_personnel_delete_owner_or_admin on public.report_personnel
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_process_types_select on public.report_process_types;
drop policy if exists report_process_types_insert on public.report_process_types;
drop policy if exists report_process_types_update on public.report_process_types;
drop policy if exists report_process_types_delete on public.report_process_types;

create policy report_process_types_select on public.report_process_types
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_types_insert on public.report_process_types
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_types_update on public.report_process_types
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
)
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_types_delete on public.report_process_types
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_process_actions_select on public.report_process_actions;
drop policy if exists report_process_actions_insert on public.report_process_actions;
drop policy if exists report_process_actions_update on public.report_process_actions;
drop policy if exists report_process_actions_delete on public.report_process_actions;

create policy report_process_actions_select on public.report_process_actions
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_actions_insert on public.report_process_actions
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_actions_update on public.report_process_actions
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
)
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_actions_delete on public.report_process_actions
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_photos_select on public.report_photos;
drop policy if exists report_photos_insert_owner_or_admin on public.report_photos;
drop policy if exists report_photos_delete_owner_or_admin on public.report_photos;

create policy report_photos_select on public.report_photos
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
    where reports.id = report_photos.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_photos_insert_owner_or_admin on public.report_photos
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and created_by = (select auth.uid())
  and exists (
    select 1 from public.reports
    where reports.id = report_photos.report_id
      and reports.organization_id = private.current_organization_id()
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_photos_delete_owner_or_admin on public.report_photos
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or created_by = (select auth.uid())
  )
);

drop policy if exists audit_logs_select_admin on public.audit_logs;
drop policy if exists audit_logs_insert_authenticated on public.audit_logs;

create policy audit_logs_select_admin on public.audit_logs
for select to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_admin()
);

create policy audit_logs_insert_authenticated on public.audit_logs
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and (select auth.uid()) is not null
);;
