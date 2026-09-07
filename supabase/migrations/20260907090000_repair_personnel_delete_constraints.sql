begin;

-- Personnel removal keeps operational history and snapshots. Reassert these
-- constraints for environments where the earlier history migration drifted.
alter table public.reports
  alter column created_by_user_id drop not null;

alter table public.report_photos
  alter column created_by drop not null;

alter table public.installation_assignments
  alter column assigned_to_profile_id drop not null;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id)
  references auth.users(id)
  on delete cascade;

alter table public.reports
  drop constraint if exists reports_created_by_user_id_fkey;

alter table public.reports
  add constraint reports_created_by_user_id_fkey
  foreign key (created_by_user_id)
  references public.profiles(id)
  on delete set null;

alter table public.report_photos
  drop constraint if exists report_photos_created_by_fkey;

alter table public.report_photos
  add constraint report_photos_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

alter table public.installation_assignments
  drop constraint if exists installation_assignments_assigned_to_profile_id_fkey;

alter table public.installation_assignments
  add constraint installation_assignments_assigned_to_profile_id_fkey
  foreign key (assigned_to_profile_id)
  references public.profiles(id)
  on delete set null;

commit;
