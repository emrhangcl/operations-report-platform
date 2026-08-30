begin;

create extension if not exists pgtap with schema extensions;

select plan(40);

select is(
  (
    select count(*)
      from public.organizations
     where id in (
       '10000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000002'
     )
  ),
  0::bigint,
  'test tenant organizations do not exist yet'
);

select is(
  (
    select count(*)
      from public.subscriptions
     where organization_id in (
       '10000000-0000-4000-8000-000000000001',
       '10000000-0000-4000-8000-000000000002'
     )
  ),
  0::bigint,
  'test tenant subscriptions do not exist yet'
);

select is(
  (select count(*) from public.plans),
  0::bigint,
  'clean database has no seeded plans'
);

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
values
  (
    '20000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'tenant-a@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'tenant-b@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into public.organizations (id, name, slug)
values
  ('10000000-0000-4000-8000-000000000001', 'Tenant A', 'tenant-a'),
  ('10000000-0000-4000-8000-000000000002', 'Tenant B', 'tenant-b');

insert into public.profiles (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  role,
  is_active
)
values
  (
    '20000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Tenant',
    'A',
    'tenant-a@example.test',
    'ADMIN',
    true
  ),
  (
    '20000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Tenant',
    'B',
    'tenant-b@example.test',
    'ADMIN',
    true
  );

insert into public.organization_members (organization_id, profile_id, role)
values
  (
    '10000000-0000-4000-8000-000000000001',
    '20000000-0000-4000-8000-000000000001',
    'OWNER'
  ),
  (
    '10000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000002',
    'OWNER'
  );

insert into public.companies (id, organization_id, name)
values
  (
    '30000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'Tenant A Customer'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'Tenant B Customer'
  );

insert into public.plans (
  id,
  code,
  name,
  monthly_price_minor,
  is_public
)
values (
  '60000000-0000-4000-8000-000000000001',
  'tenant_test',
  'Tenant Test',
  10000,
  true
);

insert into public.subscriptions (
  id,
  organization_id,
  plan_id,
  status,
  billing_interval
)
values
  (
    '70000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '60000000-0000-4000-8000-000000000001',
    'active',
    'monthly'
  ),
  (
    '70000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '60000000-0000-4000-8000-000000000001',
    'active',
    'monthly'
  );

insert into public.payments (
  id,
  organization_id,
  subscription_id,
  provider,
  status,
  amount_minor
)
values
  (
    '80000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    '70000000-0000-4000-8000-000000000001',
    'test',
    'succeeded',
    10000
  ),
  (
    '80000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    '70000000-0000-4000-8000-000000000002',
    'test',
    'succeeded',
    10000
  );

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
values
  (
    '40000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001',
    'SUBMITTED',
    '2026-08-29',
    '20000000-0000-4000-8000-000000000001',
    '',
    '30000000-0000-4000-8000-000000000001'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002',
    'SUBMITTED',
    '2026-08-29',
    '20000000-0000-4000-8000-000000000002',
    '',
    '30000000-0000-4000-8000-000000000002'
  );

insert into public.report_photos (
  id,
  report_id,
  storage_path,
  category,
  created_by
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/a.jpg',
    'report',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/b.jpg',
    'report',
    '20000000-0000-4000-8000-000000000002'
  );

insert into storage.objects (bucket_id, name, owner_id)
values
  (
    'report-photos',
    '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/a.jpg',
    '20000000-0000-4000-8000-000000000001'
  ),
  (
    'report-photos',
    '10000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/b.jpg',
    '20000000-0000-4000-8000-000000000002'
  );

select is(
  (select report_number from public.reports where id = '40000000-0000-4000-8000-000000000001'),
  'RPR-2026-000001',
  'tenant A starts its report sequence at one'
);

select is(
  (select report_number from public.reports where id = '40000000-0000-4000-8000-000000000002'),
  'RPR-2026-000001',
  'tenant B has an independent report sequence'
);

select is(
  (select count(*) from public.report_number_counters where year = 2026),
  2::bigint,
  'report counters are stored separately per tenant'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  private.current_organization_id(),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'tenant A resolves its own organization'
);

select is((select count(*) from public.organizations), 1::bigint, 'tenant A sees one organization');
select is((select count(*) from public.organization_members), 1::bigint, 'tenant A sees only its membership');
select is((select count(*) from public.profiles), 1::bigint, 'tenant A sees only its profiles');
select is((select count(*) from public.companies), 1::bigint, 'tenant A sees only its companies');
select is(
  (select count(*) from public.companies where id = '30000000-0000-4000-8000-000000000002'),
  0::bigint,
  'tenant A cannot select tenant B company by id'
);
select is((select count(*) from public.reports), 1::bigint, 'tenant A sees only its reports');
select is(
  (select count(*) from public.reports where id = '40000000-0000-4000-8000-000000000002'),
  0::bigint,
  'tenant A cannot select tenant B report by id'
);
select is((select count(*) from public.report_photos), 1::bigint, 'tenant A sees only its photo metadata');
select is((select count(*) from storage.objects), 1::bigint, 'tenant A sees only its photo object');
select is((select count(*) from public.subscriptions), 1::bigint, 'tenant A sees only its subscription');
select is((select count(*) from public.payments), 1::bigint, 'tenant A sees only its payments');
select is((select count(*) from public.plans), 1::bigint, 'tenant A can read the public plan catalog');
select is(
  has_table_privilege('private.platform_admins', 'select'),
  false,
  'authenticated users cannot read platform administrators'
);
select is(
  has_table_privilege('public.report_number_counters', 'select'),
  false,
  'authenticated users cannot read report counters'
);

select lives_ok(
  $$insert into public.companies (name) values ('Tenant A Default Company')$$,
  'tenant A can insert a company with organization defaulted from the JWT'
);

select is(
  (
    select organization_id
      from public.companies
     where name = 'Tenant A Default Company'
  ),
  '10000000-0000-4000-8000-000000000001'::uuid,
  'tenant default assigns the current organization'
);

select throws_ok(
  $$
    insert into public.companies (organization_id, name)
    values ('10000000-0000-4000-8000-000000000002', 'Cross Tenant Company')
  $$,
  '42501',
  'new row violates row-level security policy for table "companies"',
  'tenant A cannot insert a company into tenant B'
);

select throws_ok(
  $$
    insert into public.reports (
      client_request_id,
      organization_id,
      status,
      report_date,
      created_by_user_id,
      created_by_name_snapshot
    )
    values (
      '41000000-0000-4000-8000-000000000003',
      '10000000-0000-4000-8000-000000000001',
      'DRAFT',
      '2026-08-29',
      '20000000-0000-4000-8000-000000000002',
      ''
    )
  $$,
  'P0001',
  'Başka firmaya ait personel rapor oluşturamaz.',
  'report trigger rejects a creator from another tenant'
);

select throws_ok(
  $$
    insert into public.report_photos (report_id, storage_path, category, created_by)
    values (
      '40000000-0000-4000-8000-000000000002',
      '10000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/c.jpg',
      'report',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  'P0001',
  'Fotoğraf için geçerli rapor bulunamadı.',
  'photo trigger rejects cross-tenant metadata'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'report-photos',
      '10000000-0000-4000-8000-000000000002/40000000-0000-4000-8000-000000000002/c.jpg',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'tenant A cannot upload into tenant B storage path'
);

select lives_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'report-photos',
      '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/a2.jpg',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  'tenant A can upload its own object into its own report path'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'report-photos',
      '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/a2.jpg',
      '20000000-0000-4000-8000-000000000002'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'tenant A cannot upload an object owned by another user'
);

select throws_ok(
  $$
    insert into storage.objects (bucket_id, name, owner_id)
    values (
      'report-photos',
      '10000000-0000-4000-8000-000000000001/40000000-0000-4000-8000-000000000001/a2.svg',
      '20000000-0000-4000-8000-000000000001'
    )
  $$,
  '42501',
  'new row violates row-level security policy for table "objects"',
  'tenant A cannot upload an unsupported storage extension'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '20000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"20000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

select is(
  private.current_organization_id(),
  '10000000-0000-4000-8000-000000000002'::uuid,
  'tenant B resolves its own organization'
);
select is((select count(*) from public.organizations), 1::bigint, 'tenant B sees one organization');
select is((select count(*) from public.companies), 1::bigint, 'tenant B sees only its companies');
select is(
  (select count(*) from public.companies where id = '30000000-0000-4000-8000-000000000001'),
  0::bigint,
  'tenant B cannot select tenant A company by id'
);
select is((select count(*) from public.reports), 1::bigint, 'tenant B sees only its reports');
select is(
  (select count(*) from public.reports where id = '40000000-0000-4000-8000-000000000001'),
  0::bigint,
  'tenant B cannot select tenant A report by id'
);
select is((select count(*) from storage.objects), 1::bigint, 'tenant B sees only its photo object');
select is((select count(*) from public.subscriptions), 1::bigint, 'tenant B sees only its subscription');
select is((select count(*) from public.payments), 1::bigint, 'tenant B sees only its payments');

reset role;
set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claim.role', 'anon', true);
select set_config('request.jwt.claims', '{"role":"anon"}', true);

select is((select count(*) from public.plans), 1::bigint, 'anonymous users can read public plans');

select * from finish();
rollback;
