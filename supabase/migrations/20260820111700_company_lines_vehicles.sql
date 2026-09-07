begin;

create table if not exists public.company_lines (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists company_lines_company_name_unique
on public.company_lines (company_id, lower(name));

create unique index if not exists vehicles_plate_unique
on public.vehicles (lower(plate));

create index if not exists company_lines_company_id_idx on public.company_lines (company_id);

drop trigger if exists company_lines_set_updated_at on public.company_lines;
create trigger company_lines_set_updated_at
before update on public.company_lines
for each row execute function public.set_updated_at();

drop trigger if exists vehicles_set_updated_at on public.vehicles;
create trigger vehicles_set_updated_at
before update on public.vehicles
for each row execute function public.set_updated_at();

drop trigger if exists company_lines_audit on public.company_lines;
create trigger company_lines_audit
after insert or update or delete on public.company_lines
for each row execute function public.log_admin_change();

drop trigger if exists vehicles_audit on public.vehicles;
create trigger vehicles_audit
after insert or update or delete on public.vehicles
for each row execute function public.log_admin_change();

alter table public.company_lines enable row level security;
alter table public.vehicles enable row level security;

drop policy if exists company_lines_select on public.company_lines;
create policy company_lines_select on public.company_lines
for select
using (public.is_admin() or public.is_active_profile());

drop policy if exists company_lines_insert_admin on public.company_lines;
create policy company_lines_insert_admin on public.company_lines
for insert
with check (public.is_admin());

drop policy if exists company_lines_update_admin on public.company_lines;
create policy company_lines_update_admin on public.company_lines
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists company_lines_delete_admin on public.company_lines;
create policy company_lines_delete_admin on public.company_lines
for delete
using (public.is_admin());

drop policy if exists vehicles_select on public.vehicles;
create policy vehicles_select on public.vehicles
for select
using (public.is_admin() or public.is_active_profile());

drop policy if exists vehicles_insert_admin on public.vehicles;
create policy vehicles_insert_admin on public.vehicles
for insert
with check (public.is_admin());

drop policy if exists vehicles_update_admin on public.vehicles;
create policy vehicles_update_admin on public.vehicles
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists vehicles_delete_admin on public.vehicles;
create policy vehicles_delete_admin on public.vehicles
for delete
using (public.is_admin());

commit;
