begin;

do $$
begin
  create type public.organization_status as enum ('active', 'suspended', 'closed');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.organization_member_role as enum ('OWNER', 'ADMIN', 'PERSONNEL');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.subscription_status as enum (
    'pending',
    'active',
    'past_due',
    'grace_period',
    'read_only',
    'canceled',
    'lifetime'
  );
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.billing_interval as enum ('monthly', 'yearly', 'lifetime');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.payment_status as enum ('pending', 'succeeded', 'failed', 'refunded', 'canceled');
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  create type public.invoice_status as enum ('draft', 'open', 'paid', 'void', 'uncollectible');
exception
  when duplicate_object then null;
end
$$;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  status public.organization_status not null default 'active',
  legal_name text,
  tax_identifier text,
  billing_email text,
  timezone text not null default 'Europe/Istanbul',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);

create table if not exists public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  role public.organization_member_role not null default 'PERSONNEL',
  is_active boolean not null default true,
  created_by_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, profile_id)
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'),
  name text not null check (length(btrim(name)) between 2 and 120),
  description text,
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  monthly_price_minor bigint check (monthly_price_minor is null or monthly_price_minor >= 0),
  yearly_price_minor bigint check (yearly_price_minor is null or yearly_price_minor >= 0),
  is_active boolean not null default true,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  plan_id uuid references public.plans(id) on delete restrict,
  status public.subscription_status not null default 'pending',
  billing_interval public.billing_interval not null,
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  starts_at timestamptz,
  current_period_starts_at timestamptz,
  current_period_ends_at timestamptz,
  grace_period_ends_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'lifetime' or billing_interval = 'lifetime'),
  check (billing_interval <> 'lifetime' or current_period_ends_at is null)
);

create table if not exists public.entitlements (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.plans(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9]+(?:\.[a-z0-9_]+)*$'),
  enabled boolean not null default true,
  value jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(plan_id, organization_id) = 1)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  provider text not null,
  external_payment_id text,
  status public.payment_status not null default 'pending',
  amount_minor bigint not null check (amount_minor >= 0),
  refunded_amount_minor bigint not null default 0 check (
    refunded_amount_minor >= 0 and refunded_amount_minor <= amount_minor
  ),
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete restrict,
  payment_id uuid references public.payments(id) on delete set null,
  provider text not null,
  external_event_id text not null,
  event_type text not null,
  signature_verified boolean not null default false,
  payload_hash text not null,
  processed_at timestamptz,
  processing_error text,
  received_at timestamptz not null default now(),
  unique (provider, external_event_id)
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  payment_id uuid references public.payments(id) on delete set null,
  provider text,
  external_invoice_id text,
  invoice_number text,
  status public.invoice_status not null default 'draft',
  currency text not null default 'TRY' check (currency ~ '^[A-Z]{3}$'),
  subtotal_minor bigint not null default 0 check (subtotal_minor >= 0),
  tax_minor bigint not null default 0 check (tax_minor >= 0),
  total_minor bigint not null default 0 check (total_minor >= 0),
  issued_at timestamptz,
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create schema if not exists private;
revoke all on schema private from public, anon;

create table if not exists private.platform_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

revoke all on table private.platform_admins from public, anon, authenticated;
grant all on table private.platform_admins to service_role;

alter table public.profiles add column if not exists organization_id uuid;
alter table public.companies add column if not exists organization_id uuid;
alter table public.belts add column if not exists organization_id uuid;
alter table public.company_lines add column if not exists organization_id uuid;
alter table public.vehicles add column if not exists organization_id uuid;
alter table public.reports add column if not exists organization_id uuid;
alter table public.report_personnel add column if not exists organization_id uuid;
alter table public.report_process_types add column if not exists organization_id uuid;
alter table public.report_process_actions add column if not exists organization_id uuid;
alter table public.report_photos add column if not exists organization_id uuid;
alter table public.installation_assignments add column if not exists organization_id uuid;
alter table public.report_number_counters add column if not exists organization_id uuid;
alter table public.audit_logs add column if not exists organization_id uuid;

alter table public.profiles
  add constraint profiles_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.companies
  add constraint companies_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.belts
  add constraint belts_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.company_lines
  add constraint company_lines_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.vehicles
  add constraint vehicles_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.reports
  add constraint reports_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.report_personnel
  add constraint report_personnel_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.report_process_types
  add constraint report_process_types_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.report_process_actions
  add constraint report_process_actions_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.report_photos
  add constraint report_photos_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.installation_assignments
  add constraint installation_assignments_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.report_number_counters
  add constraint report_number_counters_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;
alter table public.audit_logs
  add constraint audit_logs_organization_id_fkey
  foreign key (organization_id) references public.organizations(id) on delete restrict not valid;

create index if not exists organization_members_profile_idx
  on public.organization_members (profile_id, is_active);
create index if not exists organization_members_created_by_idx
  on public.organization_members (created_by_profile_id)
  where created_by_profile_id is not null;
create index if not exists subscriptions_organization_status_idx
  on public.subscriptions (organization_id, status);
create index if not exists subscriptions_plan_idx on public.subscriptions (plan_id);
create unique index if not exists subscriptions_provider_reference_unique_idx
  on public.subscriptions (provider, provider_subscription_id)
  where provider is not null and provider_subscription_id is not null;
create unique index if not exists entitlements_plan_code_unique_idx
  on public.entitlements (plan_id, code) where plan_id is not null;
create unique index if not exists entitlements_organization_code_unique_idx
  on public.entitlements (organization_id, code) where organization_id is not null;
create index if not exists payments_organization_status_idx
  on public.payments (organization_id, status, created_at desc);
create index if not exists payments_subscription_idx
  on public.payments (subscription_id)
  where subscription_id is not null;
create unique index if not exists payments_provider_reference_unique_idx
  on public.payments (provider, external_payment_id)
  where external_payment_id is not null;
create index if not exists payment_events_organization_received_idx
  on public.payment_events (organization_id, received_at desc);
create index if not exists payment_events_payment_idx
  on public.payment_events (payment_id)
  where payment_id is not null;
create index if not exists invoices_organization_status_idx
  on public.invoices (organization_id, status, created_at desc);
create index if not exists invoices_subscription_idx
  on public.invoices (subscription_id)
  where subscription_id is not null;
create index if not exists invoices_payment_idx
  on public.invoices (payment_id)
  where payment_id is not null;
create unique index if not exists invoices_provider_reference_unique_idx
  on public.invoices (provider, external_invoice_id)
  where provider is not null and external_invoice_id is not null;
create index if not exists platform_admins_granted_by_idx
  on private.platform_admins (granted_by_user_id)
  where granted_by_user_id is not null;

create index if not exists profiles_organization_idx on public.profiles (organization_id);
create index if not exists companies_organization_idx on public.companies (organization_id);
create index if not exists belts_organization_idx on public.belts (organization_id);
create index if not exists company_lines_organization_idx on public.company_lines (organization_id);
create index if not exists vehicles_organization_idx on public.vehicles (organization_id);
create index if not exists reports_organization_created_idx
  on public.reports (organization_id, created_at desc);
create index if not exists reports_belt_idx
  on public.reports (belt_id)
  where belt_id is not null;
create index if not exists reports_observer_idx
  on public.reports (observer_personnel_id)
  where observer_personnel_id is not null;
create index if not exists reports_updated_by_idx
  on public.reports (updated_by_user_id)
  where updated_by_user_id is not null;
create index if not exists report_personnel_organization_idx on public.report_personnel (organization_id);
create index if not exists report_personnel_profile_idx
  on public.report_personnel (profile_id)
  where profile_id is not null;
create index if not exists report_process_types_organization_idx on public.report_process_types (organization_id);
create index if not exists report_process_actions_organization_idx on public.report_process_actions (organization_id);
create index if not exists report_photos_organization_idx on public.report_photos (organization_id);
create index if not exists report_photos_report_idx on public.report_photos (report_id);
create index if not exists report_photos_created_by_idx
  on public.report_photos (created_by)
  where created_by is not null;
create index if not exists installation_assignments_organization_idx
  on public.installation_assignments (organization_id, created_at desc);
create index if not exists installation_assignments_created_by_idx
  on public.installation_assignments (created_by_profile_id)
  where created_by_profile_id is not null;
create index if not exists audit_logs_organization_created_idx
  on public.audit_logs (organization_id, created_at desc);
create index if not exists audit_logs_actor_idx
  on public.audit_logs (actor_id)
  where actor_id is not null;

drop trigger if exists organizations_set_updated_at on public.organizations;
create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function public.set_updated_at();

drop trigger if exists organization_members_set_updated_at on public.organization_members;
create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function public.set_updated_at();

drop trigger if exists plans_set_updated_at on public.plans;
create trigger plans_set_updated_at
before update on public.plans
for each row execute function public.set_updated_at();

drop trigger if exists subscriptions_set_updated_at on public.subscriptions;
create trigger subscriptions_set_updated_at
before update on public.subscriptions
for each row execute function public.set_updated_at();

drop trigger if exists entitlements_set_updated_at on public.entitlements;
create trigger entitlements_set_updated_at
before update on public.entitlements
for each row execute function public.set_updated_at();

drop trigger if exists payments_set_updated_at on public.payments;
create trigger payments_set_updated_at
before update on public.payments
for each row execute function public.set_updated_at();

drop trigger if exists invoices_set_updated_at on public.invoices;
create trigger invoices_set_updated_at
before update on public.invoices
for each row execute function public.set_updated_at();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.entitlements enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.invoices enable row level security;

revoke all on table public.organizations from anon, authenticated;
revoke all on table public.organization_members from anon, authenticated;
revoke all on table public.plans from anon, authenticated;
revoke all on table public.subscriptions from anon, authenticated;
revoke all on table public.entitlements from anon, authenticated;
revoke all on table public.payments from anon, authenticated;
revoke all on table public.payment_events from anon, authenticated;
revoke all on table public.invoices from anon, authenticated;

grant select on table public.plans to anon, authenticated;
grant select, update on table public.organizations to authenticated;
grant select, insert, update, delete on table public.organization_members to authenticated;
grant select on table public.subscriptions to authenticated;
grant select on table public.entitlements to authenticated;
grant select on table public.payments to authenticated;
grant select on table public.invoices to authenticated;

grant all on table public.organizations to service_role;
grant all on table public.organization_members to service_role;
grant all on table public.plans to service_role;
grant all on table public.subscriptions to service_role;
grant all on table public.entitlements to service_role;
grant all on table public.payments to service_role;
grant all on table public.payment_events to service_role;
grant all on table public.invoices to service_role;

grant usage on type public.organization_status to authenticated, service_role;
grant usage on type public.organization_member_role to authenticated, service_role;
grant usage on type public.subscription_status to authenticated, service_role;
grant usage on type public.billing_interval to authenticated, service_role;
grant usage on type public.payment_status to authenticated, service_role;
grant usage on type public.invoice_status to authenticated, service_role;

commit;
