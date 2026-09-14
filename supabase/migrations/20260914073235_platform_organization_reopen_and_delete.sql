begin;

alter table public.organizations add column deletion_started_at timestamptz;
alter table public.organizations add constraint organizations_deletion_is_closed
  check (deletion_started_at is null or status = 'closed');

-- A durable manifest survives profile/Auth deletion and allows safe retries.
create table private.organization_deletion_jobs (
  organization_id uuid primary key references public.organizations(id) on delete cascade,
  user_ids uuid[] not null,
  storage_objects jsonb not null default '[]'::jsonb,
  data_purged_at timestamptz,
  started_at timestamptz not null default now()
);
alter table private.organization_deletion_jobs enable row level security;
revoke all on private.organization_deletion_jobs from public, anon, authenticated;

create function private.guard_deletion_identity_changes()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  candidate_user_id uuid;
begin
  if tg_table_name = 'profiles' then candidate_user_id := new.id;
  elsif tg_table_name = 'platform_admins' then candidate_user_id := new.user_id;
  else candidate_user_id := new.profile_id; end if;
  -- These locks make a transfer/insert serialize with the manifest snapshot.
  perform 1 from public.profiles where id = candidate_user_id for update;
  if tg_table_name = 'platform_admins' then
    if exists (select 1 from private.organization_deletion_jobs where candidate_user_id = any(user_ids)) then
      raise exception 'organization_deletion_pending' using errcode = '23514';
    end if;
    return new;
  end if;
  perform 1 from public.organizations where id = new.organization_id for share;
  if exists (select 1 from public.organizations where id = new.organization_id and deletion_started_at is not null)
     or exists (select 1 from private.organization_deletion_jobs where candidate_user_id = any(user_ids)) then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from public.organizations where id = old.organization_id and deletion_started_at is not null
  ) then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_deletion_identity_changes() from public, anon, authenticated;
create trigger profiles_deletion_identity_guard before insert or update of id, organization_id
  on public.profiles for each row execute function private.guard_deletion_identity_changes();
create trigger memberships_deletion_identity_guard before insert or update of profile_id, organization_id
  on public.organization_members for each row execute function private.guard_deletion_identity_changes();
create trigger platform_admins_deletion_identity_guard before insert or update of user_id
  on private.platform_admins for each row execute function private.guard_deletion_identity_changes();

create function private.guard_organization_deletion_state()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if old.deletion_started_at is not null and
    (new.deletion_started_at is distinct from old.deletion_started_at or new.status <> 'closed') then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_organization_deletion_state() from public, anon, authenticated;
create trigger organizations_deletion_state_guard before update of status, deletion_started_at
  on public.organizations for each row execute function private.guard_organization_deletion_state();

create or replace function public.platform_set_organization_status(
  target_organization_id uuid, target_status public.organization_status, actor_user_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_organization public.organizations%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  select * into target_organization from public.organizations where id = target_organization_id for update;
  if not found then raise exception 'Organization was not found.' using errcode = 'P0002'; end if;
  if target_organization.deletion_started_at is not null then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  update public.organizations set status = target_status,
    closed_at = case when target_status = 'closed' then coalesce(closed_at, now()) else null end
  where id = target_organization_id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id, before_data, after_data)
  values (target_organization_id, actor_user_id,
    case when target_status = 'active' and target_organization.status = 'closed' then 'platform_organization_reopened'
      when target_status = 'active' then 'platform_organization_activated'
      when target_status = 'suspended' then 'platform_organization_suspended'
      else 'platform_organization_closure_started' end,
    'organizations', target_organization_id,
    jsonb_build_object('status', target_organization.status), jsonb_build_object('status', target_status));
  return jsonb_build_object('organization_id', target_organization_id, 'status', target_status);
end;
$$;

create function public.platform_prepare_organization_deletion(
  target_organization_id uuid, confirmation_slug text, actor_user_id uuid
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  target_organization public.organizations%rowtype;
  deletion_job private.organization_deletion_jobs%rowtype;
  selected_users uuid[];
  selected_objects jsonb;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  select * into target_organization from public.organizations where id = target_organization_id for update;
  if not found then raise exception 'Organization was not found.' using errcode = 'P0002'; end if;
  if confirmation_slug is distinct from target_organization.slug then
    raise exception 'invalid_deletion_confirmation' using errcode = '22023';
  end if;
  select * into deletion_job from private.organization_deletion_jobs where organization_id = target_organization_id;
  if found then
    if exists (select 1 from private.platform_admins where user_id = any(deletion_job.user_ids)) then
      raise exception 'protected_organization_accounts' using errcode = '23514';
    end if;
    -- Include late uploads from requests that were already in flight at startup.
    update private.organization_deletion_jobs set storage_objects = (
      select coalesce(jsonb_agg(object), '[]'::jsonb) from (
        select value as object from jsonb_array_elements(deletion_job.storage_objects)
        union
        select jsonb_build_object('bucket', bucket_id, 'name', name) from storage.objects
        where bucket_id in ('report-photos', 'organization-logos')
          and split_part(name, '/', 1) = target_organization_id::text
      ) objects
    ) where organization_id = target_organization_id returning * into deletion_job;
    return to_jsonb(deletion_job);
  end if;

  perform 1 from public.profiles where organization_id = target_organization_id for update;
  perform 1 from public.organization_members where organization_id = target_organization_id for update;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into selected_users
    from public.profiles where organization_id = target_organization_id;
  if actor_user_id = any(selected_users)
     or exists (select 1 from private.platform_admins where user_id = any(selected_users))
     or exists (select 1 from public.organization_members where profile_id = any(selected_users) and organization_id <> target_organization_id)
     or exists (select 1 from public.organization_members where organization_id = target_organization_id and not (profile_id = any(selected_users)))
     or exists (select 1 from private.platform_export_requests where requested_by_user_id = any(selected_users) and organization_id <> target_organization_id) then
    raise exception 'protected_organization_accounts' using errcode = '23514';
  end if;
  if exists (select 1 from public.reports where organization_id <> target_organization_id and
       (created_by_user_id = any(selected_users) or updated_by_user_id = any(selected_users)
        or observer_personnel_id = any(selected_users) or customer_signed_by = any(selected_users)))
     or exists (select 1 from public.report_photos where organization_id <> target_organization_id and created_by = any(selected_users))
     or exists (select 1 from public.report_personnel where organization_id <> target_organization_id and profile_id = any(selected_users))
     or exists (select 1 from public.installation_assignments where organization_id <> target_organization_id and
       (assigned_to_profile_id = any(selected_users) or created_by_profile_id = any(selected_users))) then
    raise exception 'protected_organization_accounts' using errcode = '23514';
  end if;
  -- Never remove another tenant's object to make Auth account deletion succeed.
  if exists (select 1 from storage.objects where (owner = any(selected_users) or owner_id = any(selected_users::text[]))
    and (bucket_id not in ('report-photos', 'organization-logos') or split_part(name, '/', 1) <> target_organization_id::text))
    or exists (select 1 from public.report_photos where organization_id = target_organization_id and split_part(storage_path, '/', 1) <> target_organization_id::text)
    or (target_organization.logo_path is not null and split_part(target_organization.logo_path, '/', 1) <> target_organization_id::text)
    or exists (select 1 from private.platform_export_requests where organization_id = target_organization_id and artifact_path is not null) then
    raise exception 'out_of_scope_organization_files' using errcode = '23514';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', name)), '[]'::jsonb)
    into selected_objects from storage.objects where bucket_id in ('report-photos', 'organization-logos')
      and split_part(name, '/', 1) = target_organization_id::text;
  insert into private.organization_deletion_jobs (organization_id, user_ids, storage_objects)
    values (target_organization_id, selected_users, selected_objects) returning * into deletion_job;
  update public.organizations set status = 'closed', closed_at = coalesce(closed_at, now()), deletion_started_at = now()
    where id = target_organization_id;
  update public.profiles set is_active = false where organization_id = target_organization_id;
  update public.organization_members set is_active = false where organization_id = target_organization_id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id)
    values (target_organization_id, actor_user_id, 'platform_organization_deletion_started', 'organizations', target_organization_id);
  return to_jsonb(deletion_job);
end;
$$;

create function public.platform_purge_organization_data(target_organization_id uuid, actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  deletion_job private.organization_deletion_jobs%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  perform 1 from public.organizations where id = target_organization_id for update;
  select * into deletion_job from private.organization_deletion_jobs where organization_id = target_organization_id for update;
  if not found then raise exception 'Organization deletion was not started.' using errcode = 'P0002'; end if;
  -- Parent deletion preserves the signed-report guards and uses existing FK cascades.
  delete from public.installation_assignments where organization_id = target_organization_id;
  delete from public.reports where organization_id = target_organization_id;
  delete from public.company_lines where organization_id = target_organization_id;
  delete from public.companies where organization_id = target_organization_id;
  delete from public.belts where organization_id = target_organization_id;
  delete from public.equipment where organization_id = target_organization_id;
  delete from public.vehicles where organization_id = target_organization_id;
  delete from public.report_number_counters where organization_id = target_organization_id;
  delete from public.invoices where organization_id = target_organization_id;
  delete from public.payment_events where organization_id = target_organization_id;
  delete from public.payments where organization_id = target_organization_id;
  delete from public.entitlements where organization_id = target_organization_id;
  delete from public.subscriptions where organization_id = target_organization_id;
  delete from private.platform_export_requests where organization_id = target_organization_id;
  delete from public.organization_members where organization_id = target_organization_id;
  delete from public.profiles where organization_id = target_organization_id;
  update private.organization_deletion_jobs set data_purged_at = now() where organization_id = target_organization_id;
  return jsonb_build_object('organization_id', target_organization_id, 'data_purged', true);
end;
$$;

create function public.platform_finish_organization_deletion(target_organization_id uuid, actor_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  deletion_job private.organization_deletion_jobs%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  perform 1 from public.organizations where id = target_organization_id for update;
  select * into deletion_job from private.organization_deletion_jobs where organization_id = target_organization_id for update;
  if not found or deletion_job.data_purged_at is null then
    raise exception 'organization_deletion_not_ready' using errcode = '23514';
  end if;
  if exists (select 1 from auth.users where id = any(deletion_job.user_ids)) then
    raise exception 'organization_auth_cleanup_required' using errcode = '23514';
  end if;
  if exists (select 1 from storage.objects where bucket_id in ('report-photos', 'organization-logos') and split_part(name, '/', 1) = target_organization_id::text) then
    raise exception 'organization_storage_cleanup_required' using errcode = '23514';
  end if;
  -- Clean records created by late billing callbacks before removing the tenant.
  perform public.platform_purge_organization_data(target_organization_id, actor_user_id);
  delete from public.audit_logs where organization_id = target_organization_id;
  delete from public.organizations where id = target_organization_id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id, after_data)
    values (null, actor_user_id, 'platform_organization_deleted', 'organizations', target_organization_id,
      jsonb_build_object('deleted_accounts', cardinality(deletion_job.user_ids)));
  return jsonb_build_object('organization_id', target_organization_id, 'deleted_accounts', cardinality(deletion_job.user_ids));
end;
$$;

revoke execute on function public.platform_set_organization_status(uuid, public.organization_status, uuid) from public, anon, authenticated;
revoke execute on function public.platform_prepare_organization_deletion(uuid, text, uuid) from public, anon, authenticated;
revoke execute on function public.platform_purge_organization_data(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.platform_finish_organization_deletion(uuid, uuid) from public, anon, authenticated;
grant execute on function public.platform_set_organization_status(uuid, public.organization_status, uuid) to service_role;
grant execute on function public.platform_prepare_organization_deletion(uuid, text, uuid) to service_role;
grant execute on function public.platform_purge_organization_data(uuid, uuid) to service_role;
grant execute on function public.platform_finish_organization_deletion(uuid, uuid) to service_role;

commit;
