begin;

revoke all privileges on all tables in schema public from anon;
revoke all privileges on all sequences in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;

revoke execute on function public.current_user_role() from public, anon;
revoke execute on function public.is_active_profile() from public, anon;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.current_user_role() to authenticated, service_role;
grant execute on function public.is_active_profile() to authenticated, service_role;
grant execute on function public.is_admin() to authenticated, service_role;

revoke execute on function public.log_admin_change() from public, anon, authenticated;
revoke execute on function public.prepare_report() from public, anon, authenticated;
revoke execute on function public.prepare_installation_assignment() from public, anon, authenticated;
revoke execute on function public.guard_installation_assignment_personnel_update() from public, anon, authenticated;
revoke execute on function public.set_updated_at() from public, anon, authenticated;
alter function public.set_updated_at() set search_path = public;

drop policy if exists report_photo_objects_insert on storage.objects;
create policy report_photo_objects_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-photos'
  and public.is_active_profile()
  and exists (
    select 1
    from public.reports
    where reports.id::text = (storage.foldername(name))[1]
      and (
        public.is_admin()
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
        public.is_admin()
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
        public.is_admin()
        or report_photos.created_by = (select auth.uid())
        or reports.created_by_user_id = (select auth.uid())
      )
  )
);

commit;
