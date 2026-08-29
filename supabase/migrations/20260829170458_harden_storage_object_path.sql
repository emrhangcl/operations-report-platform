begin;

update storage.buckets
   set public = false,
       file_size_limit = 5242880,
       allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']
 where id = 'report-photos';

alter table public.report_photos
  drop constraint if exists report_photos_storage_path_format_check;

alter table public.report_photos
  add constraint report_photos_storage_path_format_check
  check (
    storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp)$'
  ) not valid;

drop policy if exists report_photo_objects_insert on storage.objects;
create policy report_photo_objects_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-photos'
  and owner_id = (select auth.uid()::text)
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp)$'
  and (storage.foldername(name))[1] = private.current_organization_id()::text
  and exists (
    select 1
      from public.reports
     where reports.id::text = (storage.foldername(name))[2]
       and reports.organization_id = private.current_organization_id()
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

commit;
