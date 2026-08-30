begin;

create or replace function private.current_organization_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select organization_id
    from public.profiles
   where id = (select auth.uid());
$$;

create or replace function private.is_organization_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.organization_members
      join public.profiles
        on profiles.id = organization_members.profile_id
      join public.organizations
        on organizations.id = organization_members.organization_id
     where organization_members.organization_id = target_organization_id
       and organization_members.profile_id = (select auth.uid())
       and organization_members.is_active
       and profiles.is_active
       and profiles.organization_id = organization_members.organization_id
       and organizations.status <> 'closed'
  );
$$;

create or replace function private.is_active_organization_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.is_organization_member(target_organization_id)
    and exists (
      select 1
        from public.organizations
       where id = target_organization_id
         and status = 'active'
    );
$$;

create or replace function private.has_organization_role(
  target_organization_id uuid,
  allowed_roles public.organization_member_role[]
)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
      from public.organization_members
      join public.profiles
        on profiles.id = organization_members.profile_id
     where organization_members.organization_id = target_organization_id
       and organization_members.profile_id = (select auth.uid())
       and organization_members.role = any(allowed_roles)
       and organization_members.is_active
       and profiles.is_active
       and profiles.organization_id = organization_members.organization_id
  );
$$;

create or replace function private.is_platform_admin(candidate_user_id uuid default auth.uid())
returns boolean
language sql
security definer
set search_path = private
stable
as $$
  select candidate_user_id is not null
    and exists (
      select 1
        from private.platform_admins
       where user_id = candidate_user_id
    );
$$;

create or replace function private.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role
    from public.profiles
   where id = (select auth.uid());
$$;

create or replace function private.is_admin()
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.is_active_organization_member(private.current_organization_id())
    and private.has_organization_role(
      private.current_organization_id(),
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    );
$$;

create or replace function private.is_active_profile()
returns boolean
language sql
security definer
set search_path = private
stable
as $$
  select private.is_active_organization_member(private.current_organization_id());
$$;

revoke execute on function private.current_organization_id() from public, anon;
revoke execute on function private.is_organization_member(uuid) from public, anon;
revoke execute on function private.is_active_organization_member(uuid) from public, anon;
revoke execute on function private.has_organization_role(uuid, public.organization_member_role[]) from public, anon;
revoke execute on function private.is_platform_admin(uuid) from public, anon, authenticated;
revoke execute on function private.current_user_role() from public, anon;
revoke execute on function private.is_admin() from public, anon;
revoke execute on function private.is_active_profile() from public, anon;

grant execute on function private.current_organization_id() to authenticated, service_role;
grant execute on function private.is_organization_member(uuid) to authenticated, service_role;
grant execute on function private.is_active_organization_member(uuid) to authenticated, service_role;
grant execute on function private.has_organization_role(uuid, public.organization_member_role[])
  to authenticated, service_role;
grant execute on function private.is_platform_admin(uuid) to service_role;
grant execute on function private.current_user_role() to authenticated, service_role;
grant execute on function private.is_admin() to authenticated, service_role;
grant execute on function private.is_active_profile() to authenticated, service_role;

alter table public.profiles
  alter column organization_id set not null;
alter table public.companies
  alter column organization_id set default private.current_organization_id(),
  alter column organization_id set not null;
alter table public.belts
  alter column organization_id set default private.current_organization_id(),
  alter column organization_id set not null;
alter table public.company_lines
  alter column organization_id set not null;
alter table public.vehicles
  alter column organization_id set default private.current_organization_id(),
  alter column organization_id set not null;
alter table public.reports
  alter column organization_id set default private.current_organization_id(),
  alter column organization_id set not null;
alter table public.report_personnel
  alter column organization_id set not null;
alter table public.report_process_types
  alter column organization_id set not null;
alter table public.report_process_actions
  alter column organization_id set not null;
alter table public.report_photos
  alter column organization_id set not null;
alter table public.installation_assignments
  alter column organization_id set default private.current_organization_id(),
  alter column organization_id set not null;
alter table public.report_number_counters
  alter column organization_id set not null;
alter table public.audit_logs
  alter column organization_id set default private.current_organization_id();

alter table public.profiles validate constraint profiles_organization_id_fkey;
alter table public.companies validate constraint companies_organization_id_fkey;
alter table public.belts validate constraint belts_organization_id_fkey;
alter table public.company_lines validate constraint company_lines_organization_id_fkey;
alter table public.vehicles validate constraint vehicles_organization_id_fkey;
alter table public.reports validate constraint reports_organization_id_fkey;
alter table public.report_personnel validate constraint report_personnel_organization_id_fkey;
alter table public.report_process_types validate constraint report_process_types_organization_id_fkey;
alter table public.report_process_actions validate constraint report_process_actions_organization_id_fkey;
alter table public.report_photos validate constraint report_photos_organization_id_fkey;
alter table public.installation_assignments validate constraint installation_assignments_organization_id_fkey;
alter table public.report_number_counters validate constraint report_number_counters_organization_id_fkey;
alter table public.audit_logs validate constraint audit_logs_organization_id_fkey;

alter table public.report_number_counters
  drop constraint if exists report_number_counters_pkey;
alter table public.report_number_counters
  add constraint report_number_counters_pkey primary key (organization_id, year);

alter table public.reports
  drop constraint if exists reports_report_number_key;
alter table public.reports
  drop constraint if exists reports_number_pair_unique;
create unique index if not exists reports_organization_number_unique_idx
  on public.reports (organization_id, report_number)
  where report_number is not null;
create unique index if not exists reports_organization_sequence_unique_idx
  on public.reports (organization_id, report_year, sequence_number)
  where report_year is not null and sequence_number is not null;

drop index if exists public.vehicles_plate_unique;
create unique index if not exists vehicles_organization_plate_unique_idx
  on public.vehicles (organization_id, lower(plate));
create unique index if not exists belts_organization_code_unique_idx
  on public.belts (organization_id, lower(code));

create or replace function private.set_company_line_organization()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_organization_id uuid;
begin
  select organization_id
    into parent_organization_id
    from public.companies
   where id = new.company_id;

  if parent_organization_id is null then
    raise exception 'Hat için geçerli firma bulunamadı.';
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Hat organizasyonu değiştirilemez.';
  end if;

  new.organization_id = parent_organization_id;
  return new;
end;
$$;

create or replace function private.set_report_child_organization()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_organization_id uuid;
  linked_profile_organization_id uuid;
begin
  select organization_id
    into parent_organization_id
    from public.reports
   where id = new.report_id;

  if parent_organization_id is null then
    raise exception 'Rapor alt kaydı için geçerli rapor bulunamadı.';
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Rapor alt kaydının organizasyonu değiştirilemez.';
  end if;

  if tg_table_name = 'report_personnel' and new.profile_id is not null then
    select organization_id
      into linked_profile_organization_id
      from public.profiles
     where id = new.profile_id;

    if linked_profile_organization_id is distinct from parent_organization_id then
      raise exception 'Başka firmaya ait personel rapora eklenemez.';
    end if;
  end if;

  new.organization_id = parent_organization_id;
  return new;
end;
$$;

create or replace function private.prepare_report_photo()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  parent_organization_id uuid;
  creator_organization_id uuid;
begin
  select organization_id
    into parent_organization_id
    from public.reports
   where id = new.report_id;

  if parent_organization_id is null then
    raise exception 'Fotoğraf için geçerli rapor bulunamadı.';
  end if;

  if new.created_by is not null then
    select organization_id
      into creator_organization_id
      from public.profiles
     where id = new.created_by;

    if creator_organization_id is distinct from parent_organization_id then
      raise exception 'Başka firmaya ait kullanıcı fotoğraf ekleyemez.';
    end if;
  end if;

  if split_part(new.storage_path, '/', 1) <> parent_organization_id::text
    or split_part(new.storage_path, '/', 2) <> new.report_id::text
    or split_part(new.storage_path, '/', 3) = '' then
    raise exception 'Fotoğraf yolu organization_id/report_id/file biçiminde olmalıdır.';
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Fotoğraf organizasyonu değiştirilemez.';
  end if;

  new.organization_id = parent_organization_id;
  return new;
end;
$$;

revoke execute on function private.set_company_line_organization() from public, anon, authenticated;
revoke execute on function private.set_report_child_organization() from public, anon, authenticated;
revoke execute on function private.prepare_report_photo() from public, anon, authenticated;

drop trigger if exists company_lines_set_organization on public.company_lines;
create trigger company_lines_set_organization
before insert or update on public.company_lines
for each row execute function private.set_company_line_organization();

drop trigger if exists report_personnel_set_organization on public.report_personnel;
create trigger report_personnel_set_organization
before insert or update on public.report_personnel
for each row execute function private.set_report_child_organization();

drop trigger if exists report_process_types_set_organization on public.report_process_types;
create trigger report_process_types_set_organization
before insert or update on public.report_process_types
for each row execute function private.set_report_child_organization();

drop trigger if exists report_process_actions_set_organization on public.report_process_actions;
create trigger report_process_actions_set_organization
before insert or update on public.report_process_actions
for each row execute function private.set_report_child_organization();

drop trigger if exists report_photos_set_organization on public.report_photos;
create trigger report_photos_set_organization
before insert or update on public.report_photos
for each row execute function private.prepare_report_photo();

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  creator record;
  selected_company record;
  selected_belt record;
  selected_observer record;
  seq integer;
  target_report_year integer;
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
  else
    new.updated_by_user_id = auth.uid();

    if new.organization_id is distinct from old.organization_id then
      raise exception 'Rapor organizasyonu değiştirilemez.';
    end if;
  end if;

  if new.created_by_user_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Aktif kullanıcı profili bulunamadı.';
    end if;

    new.organization_id = old.organization_id;
    new.created_by_name_snapshot = coalesce(
      nullif(new.created_by_name_snapshot, ''),
      old.created_by_name_snapshot,
      'Silinmiş personel'
    );
  else
    select id, first_name, last_name, organization_id
      into creator
      from public.profiles
     where id = new.created_by_user_id;

    if creator.id is null then
      raise exception 'Aktif kullanıcı profili bulunamadı.';
    end if;

    new.organization_id = coalesce(new.organization_id, creator.organization_id);

    if creator.organization_id is distinct from new.organization_id then
      raise exception 'Başka firmaya ait personel rapor oluşturamaz.';
    end if;

    new.created_by_name_snapshot = trim(creator.first_name || ' ' || creator.last_name);
  end if;

  if new.organization_id is null then
    raise exception 'Rapor organizasyonu belirlenemedi.';
  end if;

  if new.company_id is not null then
    select id, name, address, contact_name, contact_phone
      into selected_company
      from public.companies
     where id = new.company_id
       and organization_id = new.organization_id;

    if selected_company.id is null then
      raise exception 'Firma bu organizasyona ait değil.';
    end if;

    new.company_name_snapshot = selected_company.name;
    new.company_address_snapshot = selected_company.address;
    new.company_contact_name = coalesce(nullif(new.company_contact_name, ''), selected_company.contact_name);
    new.company_contact_phone = coalesce(nullif(new.company_contact_phone, ''), selected_company.contact_phone);
  end if;

  if new.belt_id is not null then
    select id, name, code
      into selected_belt
      from public.belts
     where id = new.belt_id
       and organization_id = new.organization_id;

    if selected_belt.id is null then
      raise exception 'Bant bu organizasyona ait değil.';
    end if;

    new.belt_name_snapshot = selected_belt.name;
    new.belt_code_snapshot = selected_belt.code;
  end if;

  if new.observer_personnel_id is not null then
    select id, first_name, last_name
      into selected_observer
      from public.profiles
     where id = new.observer_personnel_id
       and organization_id = new.organization_id;

    if selected_observer.id is null then
      raise exception 'Gözlemci bu organizasyona ait değil.';
    end if;

    new.observer_name_snapshot = trim(selected_observer.first_name || ' ' || selected_observer.last_name);
  end if;

  if new.status = 'SUBMITTED' and new.report_number is null then
    target_report_year = extract(year from new.report_date)::integer;

    insert into public.report_number_counters (organization_id, year, next_value)
    values (new.organization_id, target_report_year, 2)
    on conflict (organization_id, year)
    do update
      set next_value = public.report_number_counters.next_value + 1,
          updated_at = now()
    returning next_value - 1 into seq;

    new.report_year = target_report_year;
    new.sequence_number = seq;
    new.report_number = 'RPR-' || target_report_year::text || '-' || lpad(seq::text, 6, '0');
    new.submitted_at = coalesce(new.submitted_at, now());
  end if;

  return new;
end;
$$;

create or replace function public.prepare_installation_assignment()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  selected_company record;
  creator_organization_id uuid;
  assignee_organization_id uuid;
  linked_report_organization_id uuid;
begin
  if tg_op = 'INSERT' and new.created_by_profile_id is null then
    new.created_by_profile_id = auth.uid();
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Montaj atamasının organizasyonu değiştirilemez.';
  end if;

  if new.created_by_profile_id is not null then
    select organization_id
      into creator_organization_id
      from public.profiles
     where id = new.created_by_profile_id;
  end if;

  new.organization_id = coalesce(
    new.organization_id,
    creator_organization_id,
    private.current_organization_id()
  );

  if new.organization_id is null then
    raise exception 'Montaj ataması organizasyonu belirlenemedi.';
  end if;

  if creator_organization_id is not null
    and creator_organization_id is distinct from new.organization_id then
    raise exception 'Atamayı oluşturan kullanıcı başka firmaya ait.';
  end if;

  if new.assigned_to_profile_id is not null then
    select organization_id
      into assignee_organization_id
      from public.profiles
     where id = new.assigned_to_profile_id;

    if assignee_organization_id is distinct from new.organization_id then
      raise exception 'Başka firmaya ait personele montaj atanamaz.';
    end if;
  end if;

  if new.company_id is not null then
    select id, name
      into selected_company
      from public.companies
     where id = new.company_id
       and organization_id = new.organization_id;

    if selected_company.id is null then
      raise exception 'Firma bu organizasyona ait değil.';
    end if;

    new.company_name_snapshot = selected_company.name;
  end if;

  if new.report_id is not null then
    select organization_id
      into linked_report_organization_id
      from public.reports
     where id = new.report_id;

    if linked_report_organization_id is distinct from new.organization_id then
      raise exception 'Başka firmaya ait rapor montaj atamasına bağlanamaz.';
    end if;
  end if;

  if coalesce(trim(new.title), '') = '' then
    new.title = coalesce(
      nullif(trim(concat_ws(' - ', new.company_name_snapshot, new.line_name)), ''),
      'Montaj Ataması'
    );
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'IN_PROGRESS' and new.status = 'IN_PROGRESS' then
      new.started_at = coalesce(new.started_at, now());
    end if;

    if old.status <> 'COMPLETED' and new.status = 'COMPLETED' then
      new.completed_at = coalesce(new.completed_at, now());
    end if;

    if old.status <> 'CANCELLED' and new.status = 'CANCELLED' then
      new.cancelled_at = coalesce(new.cancelled_at, now());
    end if;
  else
    if new.status = 'IN_PROGRESS' then
      new.started_at = coalesce(new.started_at, now());
    end if;

    if new.status = 'COMPLETED' then
      new.completed_at = coalesce(new.completed_at, now());
    end if;

    if new.status = 'CANCELLED' then
      new.cancelled_at = coalesce(new.cancelled_at, now());
    end if;
  end if;

  return new;
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
    or new.organization_id is distinct from old.organization_id
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

create or replace function public.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
declare
  action_name text;
  entity_data jsonb;
  entity_organization_id uuid;
begin
  entity_data = case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_organization_id = nullif(entity_data ->> 'organization_id', '')::uuid;

  if entity_organization_id is null
    or not private.has_organization_role(
      entity_organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    ) then
    return coalesce(new, old);
  end if;

  action_name = lower(tg_table_name) || '_' || lower(tg_op);

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    entity_organization_id,
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

revoke execute on function public.prepare_report() from public, anon, authenticated;
revoke execute on function public.prepare_installation_assignment() from public, anon, authenticated;
revoke execute on function public.guard_installation_assignment_personnel_update()
  from public, anon, authenticated;
revoke execute on function public.log_admin_change() from public, anon, authenticated;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.companies from anon, authenticated;
revoke all on table public.belts from anon, authenticated;
revoke all on table public.company_lines from anon, authenticated;
revoke all on table public.vehicles from anon, authenticated;
revoke all on table public.reports from anon, authenticated;
revoke all on table public.report_personnel from anon, authenticated;
revoke all on table public.report_process_types from anon, authenticated;
revoke all on table public.report_process_actions from anon, authenticated;
revoke all on table public.report_photos from anon, authenticated;
revoke all on table public.installation_assignments from anon, authenticated;
revoke all on table public.report_number_counters from anon, authenticated;
revoke all on table public.audit_logs from anon, authenticated;

grant select, update on table public.profiles to authenticated;
grant select, insert, update on table public.companies to authenticated;
grant select, insert, update on table public.belts to authenticated;
grant select, insert, update, delete on table public.company_lines to authenticated;
grant select, insert, update, delete on table public.vehicles to authenticated;
grant select, insert, update on table public.reports to authenticated;
grant select, insert, delete on table public.report_personnel to authenticated;
grant select, insert, update, delete on table public.report_process_types to authenticated;
grant select, insert, update, delete on table public.report_process_actions to authenticated;
grant select, insert, delete on table public.report_photos to authenticated;
grant select, insert, update, delete on table public.installation_assignments to authenticated;
grant select on table public.audit_logs to authenticated;

grant all on table public.profiles to service_role;
grant all on table public.companies to service_role;
grant all on table public.belts to service_role;
grant all on table public.company_lines to service_role;
grant all on table public.vehicles to service_role;
grant all on table public.reports to service_role;
grant all on table public.report_personnel to service_role;
grant all on table public.report_process_types to service_role;
grant all on table public.report_process_actions to service_role;
grant all on table public.report_photos to service_role;
grant all on table public.installation_assignments to service_role;
grant all on table public.report_number_counters to service_role;
grant all on table public.audit_logs to service_role;

drop policy if exists organizations_select_member on public.organizations;
create policy organizations_select_member on public.organizations
for select
to authenticated
using (private.is_organization_member(id));

drop policy if exists organizations_update_admin on public.organizations;
create policy organizations_update_admin on public.organizations
for update
to authenticated
using (
  id = private.current_organization_id()
  and private.has_organization_role(
    id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
)
with check (
  id = private.current_organization_id()
  and private.has_organization_role(
    id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists organization_members_select_member on public.organization_members;
create policy organization_members_select_member on public.organization_members
for select
to authenticated
using (private.is_organization_member(organization_id));

drop policy if exists plans_public_select on public.plans;
create policy plans_public_select on public.plans
for select
to anon, authenticated
using (is_active and is_public);

drop policy if exists subscriptions_select_organization_admin on public.subscriptions;
create policy subscriptions_select_organization_admin on public.subscriptions
for select
to authenticated
using (
  private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists entitlements_select on public.entitlements;
create policy entitlements_select on public.entitlements
for select
to anon, authenticated
using (
  (
    plan_id is not null
    and exists (
      select 1
        from public.plans
       where plans.id = entitlements.plan_id
         and plans.is_active
         and plans.is_public
    )
  )
  or (
    organization_id is not null
    and private.is_organization_member(organization_id)
  )
);

drop policy if exists payments_select_organization_admin on public.payments;
create policy payments_select_organization_admin on public.payments
for select
to authenticated
using (
  private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists invoices_select_organization_admin on public.invoices;
create policy invoices_select_organization_admin on public.invoices
for select
to authenticated
using (
  private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select
to authenticated
using (
  id = (select auth.uid())
  or (
    organization_id = private.current_organization_id()
    and (
      private.has_organization_role(
        organization_id,
        array['OWNER', 'ADMIN']::public.organization_member_role[]
      )
      or (private.is_active_organization_member(organization_id) and is_active)
    )
  )
);

drop policy if exists profiles_insert_admin on public.profiles;
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
)
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or (private.is_active_organization_member(organization_id) and is_active)
  )
);

drop policy if exists companies_insert_admin on public.companies;
create policy companies_insert_admin on public.companies
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
)
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists belts_select on public.belts;
create policy belts_select on public.belts
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or (private.is_active_organization_member(organization_id) and is_active)
  )
);

drop policy if exists belts_insert_admin on public.belts;
create policy belts_insert_admin on public.belts
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists belts_update_admin on public.belts;
create policy belts_update_admin on public.belts
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
)
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists company_lines_select on public.company_lines;
create policy company_lines_select on public.company_lines
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_active_organization_member(organization_id)
);

drop policy if exists company_lines_insert_admin on public.company_lines;
create policy company_lines_insert_admin on public.company_lines
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists company_lines_update_admin on public.company_lines;
create policy company_lines_update_admin on public.company_lines
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
)
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists company_lines_delete_admin on public.company_lines;
create policy company_lines_delete_admin on public.company_lines
for delete
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.is_active_organization_member(organization_id)
);

drop policy if exists vehicles_insert_admin on public.vehicles;
create policy vehicles_insert_admin on public.vehicles
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists vehicles_update_admin on public.vehicles;
create policy vehicles_update_admin on public.vehicles
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
)
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists vehicles_delete_admin on public.vehicles;
create policy vehicles_delete_admin on public.vehicles
for delete
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or (
      private.is_active_organization_member(organization_id)
      and created_by_user_id = (select auth.uid())
    )
  )
);

drop policy if exists reports_insert_active on public.reports;
create policy reports_insert_active on public.reports
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.is_active_organization_member(organization_id)
  and created_by_user_id = (select auth.uid())
);

drop policy if exists reports_update_owner_draft_or_admin on public.reports;
create policy reports_update_owner_draft_or_admin on public.reports
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or (
      private.is_active_organization_member(organization_id)
      and created_by_user_id = (select auth.uid())
      and status = 'DRAFT'
    )
  )
)
with check (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or created_by_user_id = (select auth.uid())
  )
);

drop policy if exists report_personnel_select on public.report_personnel;
create policy report_personnel_select on public.report_personnel
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1
      from public.reports
     where reports.id = report_personnel.report_id
       and reports.organization_id = report_personnel.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

drop policy if exists report_personnel_insert_owner_or_admin on public.report_personnel;
create policy report_personnel_insert_owner_or_admin on public.report_personnel
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1
      from public.reports
     where reports.id = report_personnel.report_id
       and reports.organization_id = report_personnel.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

drop policy if exists report_personnel_delete_owner_or_admin on public.report_personnel;
create policy report_personnel_delete_owner_or_admin on public.report_personnel
for delete
to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1
      from public.reports
     where reports.id = report_personnel.report_id
       and reports.organization_id = report_personnel.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

drop policy if exists report_process_types_write on public.report_process_types;
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
       and reports.organization_id = report_process_types.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);
create policy report_process_types_insert on public.report_process_types
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_types.report_id
       and reports.organization_id = report_process_types.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);
create policy report_process_types_update on public.report_process_types
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_types.report_id
       and reports.organization_id = report_process_types.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
)
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_types.report_id
       and reports.organization_id = report_process_types.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);
create policy report_process_types_delete on public.report_process_types
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_types.report_id
       and reports.organization_id = report_process_types.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

drop policy if exists report_process_actions_write on public.report_process_actions;
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
       and reports.organization_id = report_process_actions.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);
create policy report_process_actions_insert on public.report_process_actions
for insert to authenticated
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_actions.report_id
       and reports.organization_id = report_process_actions.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);
create policy report_process_actions_update on public.report_process_actions
for update to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_actions.report_id
       and reports.organization_id = report_process_actions.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
)
with check (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_actions.report_id
       and reports.organization_id = report_process_actions.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);
create policy report_process_actions_delete on public.report_process_actions
for delete to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1 from public.reports
     where reports.id = report_process_actions.report_id
       and reports.organization_id = report_process_actions.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
      )
  )
);

drop policy if exists report_photos_select on public.report_photos;
create policy report_photos_select on public.report_photos
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and exists (
    select 1
      from public.reports
     where reports.id = report_photos.report_id
       and reports.organization_id = report_photos.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

drop policy if exists report_photos_insert_owner_or_admin on public.report_photos;
create policy report_photos_insert_owner_or_admin on public.report_photos
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and created_by = (select auth.uid())
  and exists (
    select 1
      from public.reports
     where reports.id = report_photos.report_id
       and reports.organization_id = report_photos.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

drop policy if exists report_photos_delete_owner_or_admin on public.report_photos;
create policy report_photos_delete_owner_or_admin on public.report_photos
for delete
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or created_by = (select auth.uid())
  )
);

drop policy if exists installation_assignments_select on public.installation_assignments;
create policy installation_assignments_select on public.installation_assignments
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or (
      private.is_active_organization_member(organization_id)
      and assigned_to_profile_id = (select auth.uid())
    )
  )
);

drop policy if exists installation_assignments_insert_admin on public.installation_assignments;
create policy installation_assignments_insert_admin on public.installation_assignments
for insert
to authenticated
with check (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists installation_assignments_update_admin_or_assignee on public.installation_assignments;
create policy installation_assignments_update_admin_or_assignee on public.installation_assignments
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or (
      private.is_active_organization_member(organization_id)
      and assigned_to_profile_id = (select auth.uid())
      and status in ('ASSIGNED', 'IN_PROGRESS')
    )
  )
)
with check (
  organization_id = private.current_organization_id()
  and (
    private.has_organization_role(
      organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    )
    or (
      private.is_active_organization_member(organization_id)
      and assigned_to_profile_id = (select auth.uid())
      and status in ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED')
    )
  )
);

drop policy if exists installation_assignments_delete_admin on public.installation_assignments;
create policy installation_assignments_delete_admin on public.installation_assignments
for delete
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
for select
to authenticated
using (
  organization_id = private.current_organization_id()
  and private.has_organization_role(
    organization_id,
    array['OWNER', 'ADMIN']::public.organization_member_role[]
  )
);

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;

drop policy if exists report_photo_objects_insert on storage.objects;
create policy report_photo_objects_insert on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-photos'
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
     where report_photos.storage_path = objects.name
       and report_photos.organization_id = private.current_organization_id()
       and reports.organization_id = report_photos.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
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
     where report_photos.storage_path = objects.name
       and report_photos.organization_id = private.current_organization_id()
       and reports.organization_id = report_photos.organization_id
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or report_photos.created_by = (select auth.uid())
         or reports.created_by_user_id = (select auth.uid())
       )
  )
);

commit;
