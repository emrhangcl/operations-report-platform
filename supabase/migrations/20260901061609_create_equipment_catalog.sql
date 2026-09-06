create table if not exists public.equipment (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null default private.current_organization_id()
    references public.organizations(id) on delete cascade,
  name text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint equipment_name_not_blank check (btrim(name) <> '')
);

create unique index if not exists equipment_organization_name_unique_idx
  on public.equipment (organization_id, lower(name));
create index if not exists equipment_organization_active_name_idx
  on public.equipment (organization_id, is_active, lower(name));

alter table public.equipment enable row level security;

drop trigger if exists equipment_set_updated_at on public.equipment;
create trigger equipment_set_updated_at
before update on public.equipment
for each row execute function public.set_updated_at();

revoke all on table public.equipment from anon, authenticated;
grant select, insert, update, delete on table public.equipment to authenticated;
grant all on table public.equipment to service_role;
