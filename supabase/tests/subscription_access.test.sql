begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

select is(
  (
    select count(*)
      from public.organizations
     where id between '11000000-0000-4000-8000-000000000001' and '11000000-0000-4000-8000-000000000006'
  ),
  0::bigint,
  'test subscription organizations do not exist yet'
);
select is((select count(*) from public.plans), 0::bigint, 'test starts without plans');

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  ('21000000-0000-4000-8000-00000000000' || user_number)::uuid,
  'authenticated',
  'authenticated',
  'subscription-' || user_number || '@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from generate_series(1, 6) as user_number;

insert into public.organizations (id, name, slug, status)
values
  ('11000000-0000-4000-8000-000000000001', 'Write Organization', 'write-organization', 'active'),
  ('11000000-0000-4000-8000-000000000002', 'Read Organization', 'read-organization', 'active'),
  ('11000000-0000-4000-8000-000000000003', 'Pending Organization', 'pending-organization', 'suspended'),
  ('11000000-0000-4000-8000-000000000004', 'Grace Organization', 'grace-organization', 'active'),
  ('11000000-0000-4000-8000-000000000005', 'Expired Grace Organization', 'expired-grace-organization', 'active'),
  ('11000000-0000-4000-8000-000000000006', 'Lifetime Organization', 'lifetime-organization', 'active');

insert into public.profiles (id, organization_id, first_name, last_name, email, role, is_active)
select
  ('21000000-0000-4000-8000-00000000000' || user_number)::uuid,
  ('11000000-0000-4000-8000-00000000000' || user_number)::uuid,
  'Subscription',
  'User ' || user_number,
  'subscription-' || user_number || '@example.test',
  'ADMIN',
  true
from generate_series(1, 6) as user_number;

insert into public.organization_members (organization_id, profile_id, role)
select
  ('11000000-0000-4000-8000-00000000000' || user_number)::uuid,
  ('21000000-0000-4000-8000-00000000000' || user_number)::uuid,
  'OWNER'
from generate_series(1, 6) as user_number;

insert into public.plans (
  id,
  code,
  name,
  monthly_price_minor,
  yearly_price_minor,
  is_active,
  is_public
)
values (
  '61000000-0000-4000-8000-000000000001',
  'subscription_test',
  'Subscription Test',
  10000,
  100000,
  true,
  true
);

insert into public.entitlements (plan_id, code, enabled, value)
values (
  '61000000-0000-4000-8000-000000000001',
  'reports.export',
  true,
  '{"formats":["pdf","xlsx"]}'::jsonb
);

insert into public.entitlements (organization_id, code, enabled, value)
values (
  '11000000-0000-4000-8000-000000000001',
  'reports.export',
  false,
  '{}'::jsonb
);

insert into public.subscriptions (
  organization_id,
  plan_id,
  status,
  billing_interval,
  starts_at,
  current_period_starts_at,
  current_period_ends_at,
  grace_period_ends_at
)
values
  (
    '11000000-0000-4000-8000-000000000001',
    '61000000-0000-4000-8000-000000000001',
    'active',
    'monthly',
    now(),
    now(),
    now() + interval '30 days',
    null
  ),
  (
    '11000000-0000-4000-8000-000000000002',
    '61000000-0000-4000-8000-000000000001',
    'read_only',
    'monthly',
    now() - interval '60 days',
    now() - interval '60 days',
    now() - interval '30 days',
    now() - interval '23 days'
  ),
  (
    '11000000-0000-4000-8000-000000000003',
    '61000000-0000-4000-8000-000000000001',
    'pending',
    'monthly',
    null,
    null,
    null,
    null
  ),
  (
    '11000000-0000-4000-8000-000000000004',
    '61000000-0000-4000-8000-000000000001',
    'grace_period',
    'monthly',
    now() - interval '35 days',
    now() - interval '35 days',
    now() - interval '5 days',
    now() + interval '2 days'
  ),
  (
    '11000000-0000-4000-8000-000000000005',
    '61000000-0000-4000-8000-000000000001',
    'grace_period',
    'monthly',
    now() - interval '40 days',
    now() - interval '40 days',
    now() - interval '10 days',
    now() - interval '3 days'
  ),
  (
    '11000000-0000-4000-8000-000000000006',
    null,
    'lifetime',
    'lifetime',
    now(),
    now(),
    null,
    null
  );

insert into public.companies (id, organization_id, name)
select
  ('31000000-0000-4000-8000-00000000000' || organization_number)::uuid,
  ('11000000-0000-4000-8000-00000000000' || organization_number)::uuid,
  'Customer ' || organization_number
from generate_series(1, 6) as organization_number;

insert into public.reports (
  id,
  client_request_id,
  organization_id,
  status,
  report_date,
  created_by_user_id,
  created_by_name_snapshot,
  company_id
)
values (
  '41000000-0000-4000-8000-000000000002',
  '42000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000002',
  'DRAFT',
  current_date,
  '21000000-0000-4000-8000-000000000002',
  '',
  '31000000-0000-4000-8000-000000000002'
);

insert into public.report_photos (
  id,
  report_id,
  storage_path,
  category,
  created_by
)
values (
  '51000000-0000-4000-8000-000000000002',
  '41000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000002/41000000-0000-4000-8000-000000000002/existing.jpg',
  'report',
  '21000000-0000-4000-8000-000000000002'
);

insert into storage.objects (bucket_id, name, owner_id)
values (
  'report-photos',
  '11000000-0000-4000-8000-000000000002/41000000-0000-4000-8000-000000000002/existing.jpg',
  '21000000-0000-4000-8000-000000000002'
);

select throws_ok(
  $$
    insert into public.subscriptions (
      organization_id,
      plan_id,
      status,
      billing_interval
    )
    values (
      '11000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      'pending',
      'monthly'
    )
  $$,
  '23505',
  null,
  'an organization cannot have two current subscriptions'
);

select lives_ok(
  $$
    insert into public.subscriptions (
      organization_id,
      plan_id,
      status,
      billing_interval,
      is_current
    )
    values (
      '11000000-0000-4000-8000-000000000001',
      '61000000-0000-4000-8000-000000000001',
      'canceled',
      'monthly',
      false
    )
  $$,
  'historical subscriptions remain available'
);

select is(
  has_function_privilege(
    'authenticated',
    'public.reconcile_organization_subscription(uuid,timestamp with time zone)',
    'execute'
  ),
  false,
  'tenant users cannot execute lifecycle reconciliation'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}', true);

select is(
  private.subscription_access_mode('11000000-0000-4000-8000-000000000001'),
  'write',
  'active subscription has write access'
);
select ok(
  private.has_application_read_access('11000000-0000-4000-8000-000000000001'),
  'active subscription has read access'
);
select ok(
  private.has_application_write_access('11000000-0000-4000-8000-000000000001'),
  'active subscription has write permission'
);
select is((select count(*) from public.companies), 1::bigint, 'active tenant reads its own data');
select lives_ok(
  $$insert into public.companies (name) values ('Active Subscription Customer')$$,
  'active tenant can create application data'
);
select is(
  private.has_entitlement('11000000-0000-4000-8000-000000000001', 'reports.export'),
  false,
  'organization entitlement override wins over plan entitlement'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}', true);

select is(
  private.subscription_access_mode('11000000-0000-4000-8000-000000000002'),
  'read',
  'read-only subscription resolves to read access'
);
select ok(
  private.has_application_read_access('11000000-0000-4000-8000-000000000002'),
  'read-only subscription can read'
);
select is(
  private.has_application_write_access('11000000-0000-4000-8000-000000000002'),
  false,
  'read-only subscription cannot write'
);
select is((select count(*) from public.companies), 1::bigint, 'read-only tenant keeps access to existing data');
select throws_ok(
  $$insert into public.companies (name) values ('Forbidden Read-Only Customer')$$,
  '42501',
  'new row violates row-level security policy "subscription_insert_access" for table "companies"',
  'read-only tenant cannot create application data'
);
select is((select count(*) from storage.objects), 1::bigint, 'read-only tenant can view existing report photos');
select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'report-photos',
      '11000000-0000-4000-8000-000000000002/41000000-0000-4000-8000-000000000002/new.jpg',
      '21000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'new row violates row-level security policy "subscription_insert_access" for table "objects"',
  'read-only tenant cannot upload report photos'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000003', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000003","role":"authenticated"}', true);

select is(
  private.subscription_access_mode('11000000-0000-4000-8000-000000000003'),
  'blocked',
  'pending suspended organization is blocked'
);
select is(
  private.has_application_read_access('11000000-0000-4000-8000-000000000003'),
  false,
  'pending subscription cannot read application data'
);
select is((select count(*) from public.companies), 0::bigint, 'pending tenant receives no application rows');

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000004', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000004","role":"authenticated"}', true);

select is(
  private.subscription_access_mode('11000000-0000-4000-8000-000000000004'),
  'write',
  'valid grace period keeps write access'
);
select ok(
  private.has_application_write_access('11000000-0000-4000-8000-000000000004'),
  'valid grace period can write'
);
select ok(
  private.has_entitlement('11000000-0000-4000-8000-000000000004', 'reports.export'),
  'plan entitlement is available when no organization override exists'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000005', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000005","role":"authenticated"}', true);

select is(
  private.subscription_access_mode('11000000-0000-4000-8000-000000000005'),
  'read',
  'expired grace period becomes read access'
);
select is(
  private.has_application_write_access('11000000-0000-4000-8000-000000000005'),
  false,
  'expired grace period cannot write'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000006', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config('request.jwt.claims', '{"sub":"21000000-0000-4000-8000-000000000006","role":"authenticated"}', true);

select is(
  private.subscription_access_mode('11000000-0000-4000-8000-000000000006'),
  'write',
  'lifetime subscription has write access without an end date'
);
select ok(
  private.has_application_write_access('11000000-0000-4000-8000-000000000006'),
  'lifetime subscription can write'
);

reset role;
set local role service_role;
select is(
  public.reconcile_organization_subscription(
    '11000000-0000-4000-8000-000000000005',
    now()
  ),
  'read_only'::public.subscription_status,
  'service reconciliation persists expired grace as read-only'
);
select is(
  (
    select status
      from public.subscriptions
     where organization_id = '11000000-0000-4000-8000-000000000005'
       and is_current
  ),
  'read_only'::public.subscription_status,
  'reconciled subscription status is stored'
);

select * from finish();
rollback;
