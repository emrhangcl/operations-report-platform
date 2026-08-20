begin;

create extension if not exists pgcrypto;

do $$
begin
  create type public.user_role as enum ('ADMIN', 'PERSONNEL');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.report_status as enum ('DRAFT', 'SUBMITTED');
exception
  when duplicate_object then null;
end $$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  first_name text not null,
  last_name text not null,
  email text unique,
  phone text,
  role public.user_role not null default 'PERSONNEL',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text,
  contact_name text,
  contact_phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.belts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_number_counters (
  year integer primary key,
  next_value integer not null default 1,
  updated_at timestamptz not null default now()
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null unique,
  report_number text unique,
  report_year integer,
  sequence_number integer,
  status public.report_status not null default 'DRAFT',
  report_date date not null,
  created_by_user_id uuid not null references public.profiles(id) on delete restrict,
  created_by_name_snapshot text not null,
  company_id uuid references public.companies(id) on delete restrict,
  company_name_snapshot text,
  company_address_snapshot text,
  company_contact_name text,
  company_contact_phone text,
  line_name text,
  machine_brand_model text,
  customer_machine_name text,
  belt_id uuid references public.belts(id) on delete set null,
  belt_name_snapshot text,
  belt_code_snapshot text,
  vehicle_plate text,
  used_equipment text,
  workshop_departure_at timestamptz,
  customer_arrival_at timestamptz,
  customer_departure_at timestamptz,
  factory_return_at timestamptz,
  product_code text,
  product_measure text,
  product_width text,
  product_length text,
  product_quantity text,
  product_item_coil_code text,
  customer_stock_note text,
  product_types text[] not null default '{}',
  product_type_other text,
  process_actions text[] not null default '{}',
  edge_cut_method text,
  process_action_other text,
  mechanical_connection text,
  profile_material text,
  removed_belt_years text,
  replacement_reasons text[] not null default '{}',
  replacement_reason_other text,
  has_test_piece text,
  test_status text,
  observer_personnel_id uuid references public.profiles(id) on delete set null,
  observer_name_snapshot text,
  observer_external_name text,
  press_start_time time,
  press_end_time time,
  power_outage text,
  pressure_drop text,
  heat_balance_ok text,
  process_description text,
  billing_status text,
  technical_details text,
  tensioning_done text,
  customer_will_tension boolean not null default false,
  customer_tensioned_auto boolean not null default false,
  pressure_value text,
  pressure_unit text,
  pre_tension_percent text,
  line_delivered_running boolean not null default false,
  blanket_roughening_info_given text,
  blanket_info_person_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  submitted_at timestamptz,
  updated_by_user_id uuid references public.profiles(id) on delete set null,
  constraint reports_number_pair_unique unique (report_year, sequence_number),
  constraint reports_submitted_number_required check (
    status = 'DRAFT' or report_number is not null
  )
);

create table if not exists public.report_personnel (
  report_id uuid not null references public.reports(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  name_snapshot text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, name_snapshot)
);

create table if not exists public.report_process_types (
  report_id uuid not null references public.reports(id) on delete cascade,
  value text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, value)
);

create table if not exists public.report_process_actions (
  report_id uuid not null references public.reports(id) on delete cascade,
  value text not null,
  created_at timestamptz not null default now(),
  primary key (report_id, value)
);

create table if not exists public.report_photos (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.reports(id) on delete cascade,
  storage_path text not null,
  category text not null,
  caption text,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_table text not null,
  entity_id uuid,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);

create index if not exists reports_report_number_idx on public.reports (report_number);
create index if not exists reports_report_date_idx on public.reports (report_date);
create index if not exists reports_company_id_idx on public.reports (company_id);
create index if not exists reports_created_by_idx on public.reports (created_by_user_id);
create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_submitted_at_idx on public.reports (submitted_at);
create index if not exists companies_active_idx on public.companies (is_active);
create index if not exists belts_active_idx on public.belts (is_active);
create index if not exists profiles_active_idx on public.profiles (is_active);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists companies_set_updated_at on public.companies;
create trigger companies_set_updated_at
before update on public.companies
for each row execute function public.set_updated_at();

drop trigger if exists belts_set_updated_at on public.belts;
create trigger belts_set_updated_at
before update on public.belts
for each row execute function public.set_updated_at();

drop trigger if exists reports_set_updated_at on public.reports;
create trigger reports_set_updated_at
before update on public.reports
for each row execute function public.set_updated_at();

create or replace function public.current_user_role()
returns public.user_role
language sql
security definer
set search_path = public
stable
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(public.current_user_role() = 'ADMIN', false);
$$;

create or replace function public.is_active_profile()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator record;
  selected_company record;
  selected_belt record;
  selected_observer record;
  seq integer;
  report_year integer;
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id = auth.uid();
  else
    new.updated_by_user_id = auth.uid();
  end if;

  select first_name, last_name
    into creator
    from public.profiles
   where id = new.created_by_user_id;

  if creator.first_name is null then
    raise exception 'Aktif kullanıcı profili bulunamadı.';
  end if;

  new.created_by_name_snapshot = trim(creator.first_name || ' ' || creator.last_name);

  if new.company_id is not null then
    select name, address, contact_name, contact_phone
      into selected_company
      from public.companies
     where id = new.company_id;

    new.company_name_snapshot = selected_company.name;
    new.company_address_snapshot = selected_company.address;
    new.company_contact_name = coalesce(nullif(new.company_contact_name, ''), selected_company.contact_name);
    new.company_contact_phone = coalesce(nullif(new.company_contact_phone, ''), selected_company.contact_phone);
  end if;

  if new.belt_id is not null then
    select name, code
      into selected_belt
      from public.belts
     where id = new.belt_id;

    new.belt_name_snapshot = selected_belt.name;
    new.belt_code_snapshot = selected_belt.code;
  end if;

  if new.observer_personnel_id is not null then
    select first_name, last_name
      into selected_observer
      from public.profiles
     where id = new.observer_personnel_id;

    new.observer_name_snapshot = trim(selected_observer.first_name || ' ' || selected_observer.last_name);
  end if;

  if new.status = 'SUBMITTED' and new.report_number is null then
    report_year = extract(year from new.report_date)::integer;

    insert into public.report_number_counters (year, next_value)
    values (report_year, 2)
    on conflict (year)
    do update
      set next_value = public.report_number_counters.next_value + 1,
          updated_at = now()
    returning next_value - 1 into seq;

    new.report_year = report_year;
    new.sequence_number = seq;
    new.report_number = 'TNC-' || report_year::text || '-' || lpad(seq::text, 6, '0');
    new.submitted_at = coalesce(new.submitted_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists reports_prepare on public.reports;
create trigger reports_prepare
before insert or update on public.reports
for each row execute function public.prepare_report();

create or replace function public.log_admin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  action_name text;
begin
  if not public.is_admin() then
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

drop trigger if exists companies_audit on public.companies;
create trigger companies_audit
after insert or update on public.companies
for each row execute function public.log_admin_change();

drop trigger if exists belts_audit on public.belts;
create trigger belts_audit
after insert or update on public.belts
for each row execute function public.log_admin_change();

drop trigger if exists profiles_audit on public.profiles;
create trigger profiles_audit
after insert or update on public.profiles
for each row execute function public.log_admin_change();

drop trigger if exists reports_audit on public.reports;
create trigger reports_audit
after update on public.reports
for each row execute function public.log_admin_change();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.belts enable row level security;
alter table public.reports enable row level security;
alter table public.report_personnel enable row level security;
alter table public.report_process_types enable row level security;
alter table public.report_process_actions enable row level security;
alter table public.report_photos enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
for select
using (
  id = auth.uid()
  or public.is_admin()
  or (public.is_active_profile() and is_active)
);

drop policy if exists profiles_insert_admin on public.profiles;
create policy profiles_insert_admin on public.profiles
for insert
with check (public.is_admin());

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists companies_select on public.companies;
create policy companies_select on public.companies
for select
using (public.is_admin() or (public.is_active_profile() and is_active));

drop policy if exists companies_insert_admin on public.companies;
create policy companies_insert_admin on public.companies
for insert
with check (public.is_admin());

drop policy if exists companies_update_admin on public.companies;
create policy companies_update_admin on public.companies
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists belts_select on public.belts;
create policy belts_select on public.belts
for select
using (public.is_admin() or (public.is_active_profile() and is_active));

drop policy if exists belts_insert_admin on public.belts;
create policy belts_insert_admin on public.belts
for insert
with check (public.is_admin());

drop policy if exists belts_update_admin on public.belts;
create policy belts_update_admin on public.belts
for update
using (public.is_admin())
with check (public.is_admin());

drop policy if exists reports_select on public.reports;
create policy reports_select on public.reports
for select
using (public.is_admin() or created_by_user_id = auth.uid());

drop policy if exists reports_insert_active on public.reports;
create policy reports_insert_active on public.reports
for insert
with check (public.is_active_profile());

drop policy if exists reports_update_owner_draft_or_admin on public.reports;
create policy reports_update_owner_draft_or_admin on public.reports
for update
using (
  public.is_admin()
  or (created_by_user_id = auth.uid() and status = 'DRAFT')
)
with check (
  public.is_admin()
  or created_by_user_id = auth.uid()
);

drop policy if exists report_personnel_select on public.report_personnel;
create policy report_personnel_select on public.report_personnel
for select
using (
  exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_personnel_insert_owner_or_admin on public.report_personnel;
create policy report_personnel_insert_owner_or_admin on public.report_personnel
for insert
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_personnel_delete_owner_or_admin on public.report_personnel;
create policy report_personnel_delete_owner_or_admin on public.report_personnel
for delete
using (
  exists (
    select 1 from public.reports
    where reports.id = report_personnel.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_process_types_select on public.report_process_types;
create policy report_process_types_select on public.report_process_types
for select
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_process_types_write on public.report_process_types;
create policy report_process_types_write on public.report_process_types
for all
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_process_types.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_process_actions_select on public.report_process_actions;
create policy report_process_actions_select on public.report_process_actions
for select
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_process_actions_write on public.report_process_actions;
create policy report_process_actions_write on public.report_process_actions
for all
using (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
)
with check (
  exists (
    select 1 from public.reports
    where reports.id = report_process_actions.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_photos_select on public.report_photos;
create policy report_photos_select on public.report_photos
for select
using (
  exists (
    select 1 from public.reports
    where reports.id = report_photos.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_photos_insert_owner_or_admin on public.report_photos;
create policy report_photos_insert_owner_or_admin on public.report_photos
for insert
with check (
  created_by = auth.uid()
  and exists (
    select 1 from public.reports
    where reports.id = report_photos.report_id
      and (public.is_admin() or reports.created_by_user_id = auth.uid())
  )
);

drop policy if exists report_photos_delete_owner_or_admin on public.report_photos;
create policy report_photos_delete_owner_or_admin on public.report_photos
for delete
using (
  public.is_admin()
  or created_by = auth.uid()
);

drop policy if exists audit_logs_select_admin on public.audit_logs;
create policy audit_logs_select_admin on public.audit_logs
for select
using (public.is_admin());

drop policy if exists audit_logs_insert_authenticated on public.audit_logs;
create policy audit_logs_insert_authenticated on public.audit_logs
for insert
with check (auth.uid() is not null);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-photos',
  'report-photos',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id)
do update set
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists report_photo_objects_insert on storage.objects;
create policy report_photo_objects_insert on storage.objects
for insert
with check (
  bucket_id = 'report-photos'
  and public.is_active_profile()
);

drop policy if exists report_photo_objects_select on storage.objects;
create policy report_photo_objects_select on storage.objects
for select
using (
  bucket_id = 'report-photos'
  and public.is_active_profile()
);

drop policy if exists report_photo_objects_delete on storage.objects;
create policy report_photo_objects_delete on storage.objects
for delete
using (
  bucket_id = 'report-photos'
  and public.is_active_profile()
);

commit;
