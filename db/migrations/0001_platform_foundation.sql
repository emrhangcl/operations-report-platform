-- Platform temeli: kimlik dogrulama, istek baglami ve dosya depolama primitifleri.
--
-- Uygulama veritabanina yalnizca `ops_app` rolu ile baglanir. `ops_app` NOINHERIT oldugu icin
-- kendi basina hicbir tabloya erisemez; her transaction icinde server katmani su iki ayari yapar:
--
--   set local role authenticated | anon | service_role;
--   select set_config('app.user_id', '<uuid>', true);
--
-- RLS politikalari `auth.uid()` uzerinden bu baglami okur. `service_role` RLS'i atlar ve yalnizca
-- server tarafinda dogrulanmis islemler icin kullanilir.

create extension if not exists pgcrypto;

create schema if not exists auth;
create schema if not exists storage;
create schema if not exists private;

revoke all on schema auth from public;
revoke all on schema storage from public;
revoke all on schema private from public;

grant usage on schema auth to anon, authenticated, service_role;
grant usage on schema storage to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Istek baglami
-- ---------------------------------------------------------------------------

create or replace function auth.uid()
returns uuid
language sql
stable
set search_path = ''
as $$
  select nullif(current_setting('app.user_id', true), '')::uuid
$$;

revoke all on function auth.uid() from public;
grant execute on function auth.uid() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Kullanicilar ve oturumlar
-- ---------------------------------------------------------------------------

create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  encrypted_password text,
  email_confirmed_at timestamptz,
  banned_until timestamptz,
  last_sign_in_at timestamptz,
  password_changed_at timestamptz,
  failed_login_count integer not null default 0,
  locked_until timestamptz,
  raw_app_meta_data jsonb not null default '{}'::jsonb,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_format check (email = lower(btrim(email)) and position('@' in email) > 1),
  constraint users_failed_login_count_nonnegative check (failed_login_count >= 0)
);

create unique index users_email_key on auth.users (email);

create table auth.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token_hash text not null unique,
  scope text not null,
  client text not null default 'web',
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now(),
  expires_at timestamptz not null,
  revoked_at timestamptz,
  revoked_reason text,
  ip_address inet,
  user_agent text,
  constraint sessions_scope_check check (scope in ('admin', 'personnel')),
  constraint sessions_client_check check (client in ('web', 'mobile')),
  constraint sessions_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

create index sessions_active_user_idx on auth.sessions (user_id) where revoked_at is null;
create index sessions_expires_at_idx on auth.sessions (expires_at);

create table auth.one_time_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  purpose text not null,
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  requested_ip inet,
  constraint one_time_tokens_purpose_check check (purpose in ('email_verification', 'password_reset')),
  constraint one_time_tokens_token_hash_format check (token_hash ~ '^[0-9a-f]{64}$')
);

create index one_time_tokens_user_purpose_idx on auth.one_time_tokens (user_id, purpose) where consumed_at is null;

-- Kimlik dogrulama ile ilgili guvenlik olaylari (basarili/basarisiz giris, cikis, parola sifirlama).
create table auth.security_events (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  event text not null,
  user_id uuid references auth.users(id) on delete set null,
  email text,
  ip_address inet,
  user_agent text,
  detail jsonb not null default '{}'::jsonb
);

create index security_events_occurred_at_idx on auth.security_events (occurred_at desc);
create index security_events_user_idx on auth.security_events (user_id, occurred_at desc);

create or replace function auth.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger users_touch_updated_at
before update on auth.users
for each row execute function auth.touch_updated_at();

alter table auth.users enable row level security;
alter table auth.sessions enable row level security;
alter table auth.one_time_tokens enable row level security;
alter table auth.security_events enable row level security;

-- Kimlik tablolarina yalnizca server katmani (service_role) erisir.
grant select, insert, update, delete on auth.users, auth.sessions, auth.one_time_tokens to service_role;
grant select, insert on auth.security_events to service_role;

-- ---------------------------------------------------------------------------
-- Dosya depolama: metadata PostgreSQL'de, icerik yerel diskte.
-- Yetkilendirme storage.objects uzerindeki RLS politikalari ile yapilir.
-- ---------------------------------------------------------------------------

create table storage.buckets (
  id text primary key,
  name text not null unique,
  public boolean not null default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint buckets_id_format check (id ~ '^[a-z0-9][a-z0-9-]{1,62}$')
);

create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name text not null,
  owner uuid,
  owner_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_accessed_at timestamptz not null default now(),
  constraint objects_bucket_name_key unique (bucket_id, name),
  constraint objects_name_safe check (
    name !~ '(^/|//|\.\.|\\|[[:cntrl:]])'
    and length(name) between 1 and 512
  )
);

create index objects_bucket_prefix_idx on storage.objects (bucket_id, name text_pattern_ops);

create or replace function storage.foldername(name text)
returns text[]
language sql
immutable
set search_path = ''
as $$
  select (string_to_array(name, '/'))[1:greatest(cardinality(string_to_array(name, '/')) - 1, 0)]
$$;

create or replace function storage.filename(name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select (string_to_array(name, '/'))[cardinality(string_to_array(name, '/'))]
$$;

create or replace function storage.extension(name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select lower(nullif(substring(storage.filename(name) from '\.([^.]+)$'), ''))
$$;

create trigger buckets_touch_updated_at
before update on storage.buckets
for each row execute function auth.touch_updated_at();

create trigger objects_touch_updated_at
before update on storage.objects
for each row execute function auth.touch_updated_at();

alter table storage.buckets enable row level security;
alter table storage.objects enable row level security;

create policy buckets_select_authenticated on storage.buckets
for select to authenticated
using (true);

revoke all on function storage.foldername(text), storage.filename(text), storage.extension(text) from public;
grant execute on function storage.foldername(text), storage.filename(text), storage.extension(text)
  to authenticated, service_role;
grant execute on function auth.touch_updated_at() to authenticated, service_role;

grant select on storage.buckets to authenticated;
grant select, insert, update, delete on storage.objects to authenticated;
grant select, insert, update, delete on storage.buckets, storage.objects to service_role;
