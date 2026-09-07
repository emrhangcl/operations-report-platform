begin;

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select coalesce(private.current_user_role() = 'ADMIN', false);
$$;

create or replace function private.is_active_profile()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

revoke execute on function private.current_user_role() from public, anon;
revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.is_active_profile() from public, anon;
grant execute on function private.current_user_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_active_profile() to authenticated, service_role;

revoke execute on function public.current_user_role() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon, authenticated;
revoke execute on function public.is_active_profile() from public, anon, authenticated;

create or replace function public.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  action_name text;
begin
  if not private.is_admin() then
    return coalesce(new, old);
  end if;

  action_name = lower(tg_table_name) || '_' || lower(tg_op);

  insert into public.audit_logs (
    actor_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    auth.uid(),
    action_name,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

create or replace function public.guard_installation_assignment_personnel_update()
returns trigger
language plpgsql
security invoker
set search_path = public, private
as $$
begin
  if private.is_admin() then
    return new;
  end if;

  if auth.uid() is null or old.assigned_to_profile_id <> auth.uid() then
    raise exception 'Bu montaj ataması güncellenemez.';
  end if;

  if new.id is distinct from old.id
    or new.title is distinct from old.title
    or new.assigned_to_profile_id is distinct from old.assigned_to_profile_id
    or new.created_by_profile_id is distinct from old.created_by_profile_id
    or new.scheduled_date is distinct from old.scheduled_date
    or new.notes is distinct from old.notes
    or new.company_id is distinct from old.company_id
    or new.company_name_snapshot is distinct from old.company_name_snapshot
    or new.line_name is distinct from old.line_name
    or new.report_values is distinct from old.report_values
    or new.cancelled_at is distinct from old.cancelled_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Personel montaj atamasının plan bilgisini değiştiremez.';
  end if;

  if new.status not in ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED') then
    raise exception 'Personel bu montaj durumuna geçemez.';
  end if;

  return new;
end;
$$;

revoke execute on function public.log_admin_change() from public, anon, authenticated;
revoke execute on function public.guard_installation_assignment_personnel_update() from public, anon, authenticated;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or private.is_admin()
  or (private.is_active_profile() and is_active)
);

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
for insert
to authenticated
with check (private.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
for select
to authenticated
using (private.is_admin() or (private.is_active_profile() and is_active));

drop policy if exists companies_insert_admin on public.companies;
create policy companies_insert_admin on public.companies
for insert
to authenticated
with check (private.is_admin());

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists belts_select on public.belts;
create policy belts_select on public.belts
for select
to authenticated
using (private.is_admin() or (private.is_active_profile() and is_active));

drop policy if exists belts_insert_admin on public.belts;
create policy belts_insert_admin on public.belts
for insert
to authenticated
with check (private.is_admin());

drop policy if exists belts_update_admin on public.belts;
create policy belts_update_admin on public.belts
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists company_lines_select on public.company_lines;
create policy company_lines_select on public.company_lines
for select
to authenticated
using (private.is_admin() or private.is_active_profile());

drop policy if exists company_lines_insert_admin on public.company_lines;
create policy company_lines_insert_admin on public.company_lines
for insert
to authenticated
with check (private.is_admin());

drop policy if exists company_lines_update_admin on public.company_lines;
create policy company_lines_update_admin on public.company_lines
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists company_lines_delete_admin on public.company_lines;
create policy company_lines_delete_admin on public.company_lines
for delete
to authenticated
using (private.is_admin());

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles
for select
to authenticated
using (private.is_admin() or private.is_active_profile());

drop policy if exists vehicles_insert_admin on public.vehicles;
create policy vehicles_insert_admin on public.vehicles
for insert
to authenticated
with check (private.is_admin());

drop policy if exists vehicles_update_admin on public.vehicles;
create policy vehicles_update_admin on public.vehicles
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());

drop policy if exists vehicles_delete_admin on public.vehicles;
create policy vehicles_delete_admin on public.vehicles
for delete
to authenticated
using (private.is_admin());

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
for select
to authenticated
using (private.is_admin() or created_by_user_id = (select auth.uid()));

drop policy if exists reports_insert_active on public.reports;
create policy reports_insert_active on public.reports
for insert
to authenticated
with check (private.is_active_profile());

drop policy if exists reports_update_owner_draft_or_admin on public.reports;
create policy reports_update_owner_draft_or_admin on public.reports
for update
to authenticated
using (
  private.is_admin()
  or (created_by_user_id = (select auth.uid()) and status = 'DRAFT')
)
with check (
  private.is_admin()
  or created_by_user_id = (select auth.uid())
);

drop policy if exists report_personnel_select on public.report_personnel;
create policy report_personnel_select on public.report_personnel
for select
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_personnel_insert_owner_or_admin on public.report_personnel;
create policy report_personnel_insert_owner_or_admin on public.report_personnel
for insert
to authenticated
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_personnel_delete_owner_or_admin on public.report_personnel;
create policy report_personnel_delete_owner_or_admin on public.report_personnel
for delete
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_process_types_select on public.report_process_types;
create policy report_process_types_select on public.report_process_types
for select
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_process_types_write on public.report_process_types;
create policy report_process_types_insert on public.report_process_types
for insert
to authenticated
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_types_update on public.report_process_types
for update
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_types_delete on public.report_process_types
for delete
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_process_actions_select on public.report_process_actions;
create policy report_process_actions_select on public.report_process_actions
for select
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_process_actions_write on public.report_process_actions;
create policy report_process_actions_insert on public.report_process_actions
for insert
to authenticated
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_actions_update on public.report_process_actions
for update
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
)
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

create policy report_process_actions_delete on public.report_process_actions
for delete
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_photos_select on public.report_photos;
create policy report_photos_select on public.report_photos
for select
to authenticated
using (
  exists (
    select 1 from public.reports
    where reports.id = report_photos.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_photos_insert_owner_or_admin on public.report_photos;
create policy report_photos_insert_owner_or_admin on public.report_photos
for insert
to authenticated
with check (
  created_by = (select auth.uid())
  and exists (
    select 1 from public.reports
    where reports.id = report_photos.report_id
      and (private.is_admin() or reports.created_by_user_id = (select auth.uid()))
  )
);

drop policy if exists report_photos_delete_owner_or_admin on public.report_photos;
create policy report_photos_delete_owner_or_admin on public.report_photos
for delete
to authenticated
using (
  private.is_admin()
  or created_by = (select auth.uid())
);

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
for select
to authenticated
using (private.is_admin());

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated on public.audit_logs
for insert
to authenticated
with check ((select auth.uid()) is not null);

drop policy if exists installation_assignments_select on public.installation_assignments;
create policy installation_assignments_select on public.installation_assignments
for select
to authenticated
using (
  private.is_admin()
  or (
    private.is_active_profile()
    and assigned_to_profile_id = (select auth.uid())
  )
);

drop policy if exists installation_assignments_insert_admin on public.installation_assignments;
create policy installation_assignments_insert_admin on public.installation_assignments
for insert
to authenticated
with check (private.is_admin());

drop policy if exists installation_assignments_update_admin_or_assignee on public.installation_assignments;
create policy installation_assignments_update_admin_or_assignee on public.installation_assignments
for update
to authenticated
using (
  private.is_admin()
  or (
    private.is_active_profile()
    and assigned_to_profile_id = (select auth.uid())
    and status in ('ASSIGNED', 'IN_PROGRESS')
  )
)
with check (
  private.is_admin()
  or (
    private.is_active_profile()
    and assigned_to_profile_id = (select auth.uid())
    and status in ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED')
  )
);

drop policy if exists installation_assignments_delete_admin on public.installation_assignments;
create policy installation_assignments_delete_admin on public.installation_assignments
for delete
to authenticated
using (private.is_admin());

drop policy if exists report_photo_objects_insert on storage.objects;
create policy report_photo_objects_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-photos'
  and private.is_active_profile()
  and exists (
    select 1
    from public.reports
    where reports.id::text = (storage.foldername(name))[1]
      and (
        private.is_admin()
        or reports.created_by_user_id = (select auth.uid())
      )
  )
);

drop policy if exists report_photo_objects_select on storage.objects;
create policy report_photo_objects_select on storage.objects
for select
to authenticated
using (
  bucket_id = 'report-photos'
  and exists (
    select 1
    from public.report_photos
    join public.reports on reports.id = report_photos.report_id
    where report_photos.storage_path = storage.objects.name
      and (
        private.is_admin()
        or reports.created_by_user_id = (select auth.uid())
      )
  )
);

drop policy if exists report_photo_objects_delete on storage.objects;
create policy report_photo_objects_delete on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-photos'
  and exists (
    select 1
    from public.report_photos
    join public.reports on reports.id = report_photos.report_id
    where report_photos.storage_path = storage.objects.name
      and (
        private.is_admin()
        or report_photos.created_by = (select auth.uid())
        or reports.created_by_user_id = (select auth.uid())
      )
  )
);

commit;
