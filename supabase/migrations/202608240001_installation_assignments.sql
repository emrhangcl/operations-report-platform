begin;

do $$
begin
  create type public.installation_assignment_status as enum (
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.installation_assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  status public.installation_assignment_status not null default 'ASSIGNED',
  assigned_to_profile_id uuid not null references public.profiles(id) on delete restrict,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  report_id uuid references public.reports(id) on delete set null,
  scheduled_date date,
  notes text,
  company_id uuid references public.companies(id) on delete restrict,
  company_name_snapshot text,
  line_name text,
  report_values jsonb not null default '{}'::jsonb,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists installation_assignments_assigned_status_idx
on public.installation_assignments (assigned_to_profile_id, status, scheduled_date);

create index if not exists installation_assignments_company_idx
on public.installation_assignments (company_id);

create index if not exists installation_assignments_report_idx
on public.installation_assignments (report_id);

grant select, insert, update, delete on public.installation_assignments to authenticated;
grant all on public.installation_assignments to service_role;

create or replace function public.prepare_installation_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  selected_company record;
begin
  if tg_op = 'INSERT' and new.created_by_profile_id is null then
    new.created_by_profile_id = auth.uid();
  end if;

  if new.company_id is not null then
    select name
      into selected_company
      from public.companies
     where id = new.company_id;

    new.company_name_snapshot = selected_company.name;
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
  elsif tg_op = 'INSERT' then
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
set search_path = public
as $$
begin
  if public.is_admin() then
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

drop trigger if exists installation_assignments_guard_update on public.installation_assignments;
create trigger installation_assignments_guard_update
before update on public.installation_assignments
for each row execute function public.guard_installation_assignment_personnel_update();

drop trigger if exists installation_assignments_prepare on public.installation_assignments;
create trigger installation_assignments_prepare
before insert or update on public.installation_assignments
for each row execute function public.prepare_installation_assignment();

drop trigger if exists installation_assignments_set_updated_at on public.installation_assignments;
create trigger installation_assignments_set_updated_at
before update on public.installation_assignments
for each row execute function public.set_updated_at();

drop trigger if exists installation_assignments_audit on public.installation_assignments;
create trigger installation_assignments_audit
after insert or update or delete on public.installation_assignments
for each row execute function public.log_admin_change();

alter table public.installation_assignments enable row level security;

drop policy if exists installation_assignments_select on public.installation_assignments;
create policy installation_assignments_select on public.installation_assignments
for select
to authenticated
using (
  public.is_admin()
  or (
    public.is_active_profile()
    and assigned_to_profile_id = (select auth.uid())
  )
);

drop policy if exists installation_assignments_insert_admin on public.installation_assignments;
create policy installation_assignments_insert_admin on public.installation_assignments
for insert
to authenticated
with check (public.is_admin());

drop policy if exists installation_assignments_update_admin_or_assignee on public.installation_assignments;
create policy installation_assignments_update_admin_or_assignee on public.installation_assignments
for update
to authenticated
using (
  public.is_admin()
  or (
    public.is_active_profile()
    and assigned_to_profile_id = (select auth.uid())
    and status in ('ASSIGNED', 'IN_PROGRESS')
  )
)
with check (
  public.is_admin()
  or (
    public.is_active_profile()
    and assigned_to_profile_id = (select auth.uid())
    and status in ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED')
  )
);

drop policy if exists installation_assignments_delete_admin on public.installation_assignments;
create policy installation_assignments_delete_admin on public.installation_assignments
for delete
to authenticated
using (public.is_admin());

commit;
