begin;

create extension if not exists pgtap with schema extensions;

select plan(50);

select has_column('public', 'reports', 'customer_signature', 'customer_signature exists');
select has_column('public', 'reports', 'customer_signed_at', 'customer_signed_at exists');
select has_column('public', 'reports', 'customer_signed_by', 'customer_signed_by exists');
select has_column('public', 'reports', 'customer_signature_required', 'customer_signature_required exists');

select ok(
  public.validate_customer_signature(
    '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[30,0]]]}'::jsonb
  ),
  'valid bounded signature accepted'
);

select lives_ok(
  $$
    select public.validate_customer_signature(
      '{"version":"1","signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[30,0]]]}'::jsonb
    )
  $$,
  'string version validation does not crash'
);

select is(
  public.validate_customer_signature(
    '{"version":"1","signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[30,0]]]}'::jsonb
  ),
  false,
  'string version rejected'
);

select is(
  public.validate_customer_signature(
    '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":"true","strokes":[[[0,0],[30,0]]]}'::jsonb
  ),
  false,
  'string consent rejected'
);

select is(
  public.validate_customer_signature(
    '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[30,0]]],"signed_at":"2020-01-01"}'::jsonb
  ),
  false,
  'extra client-controlled keys rejected'
);

select is(
  public.validate_customer_signature(
    '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[10,0]]]}'::jsonb
  ),
  false,
  'short signature path rejected'
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
values (
  '21000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'signature-user@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, name, slug)
values ('11000000-0000-4000-8000-000000000001', 'Signature Tenant', 'signature-tenant');

insert into public.profiles (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  role,
  is_active
)
values (
  '21000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'Signature',
  'User',
  'signature-user@example.test',
  'ADMIN',
  true
);

insert into public.organization_members (organization_id, profile_id, role)
values (
  '11000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'OWNER'
);

insert into public.companies (id, organization_id, name)
values (
  '31000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001',
  'Signature Customer'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
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
      '41000000-0000-4000-8000-000000000001',
      '42000000-0000-4000-8000-000000000001',
      '11000000-0000-4000-8000-000000000001',
      'SUBMITTED',
      '2026-09-06',
      '21000000-0000-4000-8000-000000000001',
      '',
      '31000000-0000-4000-8000-000000000001'
    )
  $$,
  'legacy submitted report can remain unsigned while Expo rolls out support'
);

select is(
  (select customer_signed_at from public.reports where id = '41000000-0000-4000-8000-000000000001'),
  null,
  'legacy unsigned submission does not fake signature timestamp'
);

select is(
  (select customer_signed_by from public.reports where id = '41000000-0000-4000-8000-000000000001'),
  null,
  'legacy unsigned submission does not fake signature actor'
);

select is(
  (select customer_signature_required from public.reports where id = '41000000-0000-4000-8000-000000000001'),
  false,
  'legacy unsigned submission keeps rollout marker false'
);

select throws_ok(
  $$
    insert into public.reports (
      id,
      client_request_id,
      organization_id,
      status,
      report_date,
      created_by_user_id,
      created_by_name_snapshot,
      company_id,
      customer_signature_required
    )
    values (
      '41000000-0000-4000-8000-000000000006',
      '42000000-0000-4000-8000-000000000006',
      '11000000-0000-4000-8000-000000000001',
      'SUBMITTED',
      '2026-09-06',
      '21000000-0000-4000-8000-000000000001',
      '',
      '31000000-0000-4000-8000-000000000001',
      true
    )
  $$,
  'P0001',
  'Gönderim için geçerli müşteri yetkilisi imzası zorunludur.',
  'web-marked submitted report requires a signature'
);

select lives_ok(
  $$
    insert into public.reports (
      id,
      client_request_id,
      organization_id,
      status,
      report_date,
      created_by_user_id,
      created_by_name_snapshot,
      company_id,
      customer_signature_required,
      customer_signature,
      customer_signed_at,
      customer_signed_by
    )
    values (
      '41000000-0000-4000-8000-000000000002',
      '42000000-0000-4000-8000-000000000002',
      '11000000-0000-4000-8000-000000000001',
      'SUBMITTED',
      '2026-09-06',
      '21000000-0000-4000-8000-000000000001',
      '',
      '31000000-0000-4000-8000-000000000001',
      true,
      '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[40,0]]]}'::jsonb,
      '2020-01-01 00:00:00+00',
      null
    )
  $$,
  'valid submitted report with signature is accepted'
);

select is(
  (select customer_signed_by from public.reports where id = '41000000-0000-4000-8000-000000000002'),
  '21000000-0000-4000-8000-000000000001'::uuid,
  'signature actor is supplied from auth.uid'
);

select isnt(
  (select customer_signed_at from public.reports where id = '41000000-0000-4000-8000-000000000002'),
  '2020-01-01 00:00:00+00'::timestamptz,
  'forged signature timestamp is overwritten by database time'
);

select isnt(
  (select report_number from public.reports where id = '41000000-0000-4000-8000-000000000002'),
  null::text,
  'signature guard runs after report preparation assigns report number'
);

select lives_ok(
  $$
    insert into public.reports (
      id,
      client_request_id,
      organization_id,
      status,
      report_date,
      created_by_user_id,
      created_by_name_snapshot,
      company_id,
      customer_signature_required
    )
    values (
      '41000000-0000-4000-8000-000000000003',
      '42000000-0000-4000-8000-000000000003',
      '11000000-0000-4000-8000-000000000001',
      'DRAFT',
      '2026-09-06',
      '21000000-0000-4000-8000-000000000001',
      '',
      '31000000-0000-4000-8000-000000000001',
      true
    )
  $$,
  'draft report can be created without signature evidence'
);

select throws_ok(
  $$
    update public.reports
       set customer_signature_required = false
     where id = '41000000-0000-4000-8000-000000000003'
  $$,
  'P0001',
  'Müşteri imza zorunluluğu rapora işlendikten sonra kaldırılamaz.',
  'web rollout marker cannot be cleared once set on a report'
);

insert into public.report_personnel (report_id, organization_id, profile_id, name_snapshot)
values (
  '41000000-0000-4000-8000-000000000003',
  '11000000-0000-4000-8000-000000000001',
  '21000000-0000-4000-8000-000000000001',
  'Signature User'
);

insert into public.report_process_types (report_id, organization_id, value)
values ('41000000-0000-4000-8000-000000000003', '11000000-0000-4000-8000-000000000001', 'signed existing child');

insert into storage.objects (bucket_id, name, owner_id)
values (
  'report-photos',
  '11000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000003/signature-photo.jpg',
  '21000000-0000-4000-8000-000000000001'
);

insert into public.report_photos (
  report_id,
  organization_id,
  storage_path,
  category,
  created_by
)
values (
  '41000000-0000-4000-8000-000000000003',
  '11000000-0000-4000-8000-000000000001',
  '11000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000003/signature-photo.jpg',
  'Makine',
  '21000000-0000-4000-8000-000000000001'
);

select is(
  (select customer_signed_at from public.reports where id = '41000000-0000-4000-8000-000000000003'),
  null,
  'draft signature timestamp remains null'
);

select throws_ok(
  $$
    update public.reports
       set customer_signature = '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[40,0]]]}'::jsonb
     where id = '41000000-0000-4000-8000-000000000003'
  $$,
  'P0001',
  'Taslak raporda müşteri imza bilgisi bulunamaz.',
  'draft report cannot store signature evidence'
);

update public.reports
   set status = 'SUBMITTED'::public.report_status,
       customer_signature = '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[50,0]]]}'::jsonb
 where id = '41000000-0000-4000-8000-000000000003';

select is(
  (select customer_signed_by from public.reports where id = '41000000-0000-4000-8000-000000000003'),
  '21000000-0000-4000-8000-000000000001'::uuid,
  'draft to submitted transition records authenticated actor'
);

reset role;

alter table public.reports disable trigger reports_zz_customer_signature_guard;

insert into public.reports (
  id,
  client_request_id,
  organization_id,
  status,
  report_date,
  created_by_user_id,
  created_by_name_snapshot,
  company_id,
  report_number,
  report_year,
  sequence_number,
  submitted_at
)
values (
  '41000000-0000-4000-8000-000000000004',
  '42000000-0000-4000-8000-000000000004',
  '11000000-0000-4000-8000-000000000001',
  'SUBMITTED',
  '2026-09-06',
  '21000000-0000-4000-8000-000000000001',
  'Legacy User',
  '31000000-0000-4000-8000-000000000001',
  'LEGACY-1',
  2026,
  9001,
  now()
);

alter table public.reports enable trigger reports_zz_customer_signature_guard;

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select throws_ok(
  $$
    update public.reports
       set customer_signature = '{"version":1,"signer_name":"Ayse Demir","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[60,0]]]}'::jsonb
     where id = '41000000-0000-4000-8000-000000000004'
  $$,
  'P0001',
  'Eski gönderilmiş rapora sonradan müşteri imzası eklenemez.',
  'legacy submitted report cannot receive a later signature'
);

select throws_ok(
  $$
    update public.reports
       set technical_details = 'tampered'
     where id = '41000000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'İmzalı rapor içeriği gönderimden sonra değiştirilemez.',
  'signed report content cannot be edited'
);

select lives_ok(
  $$
    update public.reports
       set factory_return_at = '2026-09-07 18:30:00+03'::timestamptz,
           vehicle_end_km = '125120'
     where id = '41000000-0000-4000-8000-000000000002'
  $$,
  'report owner can complete return details after customer signature'
);

select is(
  (select factory_return_at from public.reports where id = '41000000-0000-4000-8000-000000000002'),
  '2026-09-07 15:30:00+00'::timestamptz,
  'signed report stores the post-service return time'
);

select is(
  (select vehicle_end_km from public.reports where id = '41000000-0000-4000-8000-000000000002'),
  '125120',
  'signed report stores the post-service return odometer'
);

select throws_ok(
  $$
    update public.reports
       set customer_signed_by = null
     where id = '41000000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'İmzayı kaydeden kullanıcı gönderimden sonra değiştirilemez.',
  'signature actor cannot be changed by ordinary update'
);

select throws_ok(
  $$
    update public.reports
       set customer_signed_at = '2020-01-01 00:00:00+00'::timestamptz
     where id = '41000000-0000-4000-8000-000000000002'
  $$,
  'P0001',
  'İmza zamanı gönderimden sonra değiştirilemez.',
  'signature timestamp cannot be changed after signing'
);

select throws_ok(
  $$
    update public.report_personnel
       set profile_id = null
     where report_id = '41000000-0000-4000-8000-000000000003'
       and name_snapshot = 'Signature User'
  $$,
  'P0001',
  'İmzalı raporun detay kayıtları gönderimden sonra değiştirilemez.',
  'ordinary signed report child foreign-key fields cannot be nulled'
);

select throws_ok(
  $$
    delete from public.report_process_types
     where report_id = '41000000-0000-4000-8000-000000000003'
       and value = 'signed existing child'
  $$,
  'P0001',
  'İmzalı raporun detay kayıtları gönderimden sonra silinemez.',
  'signed report child rows cannot be directly deleted'
);

select throws_ok(
  $$
    delete from public.report_photos
     where report_id = '41000000-0000-4000-8000-000000000003'
       and storage_path = '11000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000003/signature-photo.jpg'
  $$,
  'P0001',
  'İmzalı raporun detay kayıtları gönderimden sonra silinemez.',
  'signed report photo metadata cannot be directly deleted'
);

delete from storage.objects
 where bucket_id = 'report-photos'
   and name = '11000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000003/signature-photo.jpg';

reset role;

select is(
  (select count(*) from storage.objects
    where bucket_id = 'report-photos'
      and name = '11000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000003/signature-photo.jpg'),
  1::bigint,
  'signed report photo storage object cannot be directly deleted'
);

select is(
  (select count(*) from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'report_photo_objects_update'),
  0::bigint,
  'report photo storage update policy remains closed'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

insert into public.report_process_types (report_id, organization_id, value)
values ('41000000-0000-4000-8000-000000000004', '11000000-0000-4000-8000-000000000001', 'legacy allowed');

select throws_ok(
  $$
    insert into public.report_process_types (report_id, organization_id, value)
    values ('41000000-0000-4000-8000-000000000002', '11000000-0000-4000-8000-000000000001', 'tamper')
  $$,
  'P0001',
  'İmzalı raporun detay kayıtları gönderimden sonra değiştirilemez.',
  'signed report child inserts are blocked'
);

select throws_ok(
  $$
    update public.report_process_types
       set report_id = '41000000-0000-4000-8000-000000000004'
     where report_id = '41000000-0000-4000-8000-000000000003'
       and value = 'signed existing child'
  $$,
  'P0001',
  'İmzalı raporun detay kayıtları gönderimden sonra değiştirilemez.',
  'signed report child rows cannot be moved away from the signed report'
);

select lives_ok(
  $$
    delete from public.report_process_types
     where report_id = '41000000-0000-4000-8000-000000000004'
  $$,
  'legacy child cleanup remains available'
);

reset role;

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
values (
  '21000000-0000-4000-8000-000000000002',
  'authenticated',
  'authenticated',
  'signature-other@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.organizations (id, name, slug)
values ('11000000-0000-4000-8000-000000000002', 'Other Signature Tenant', 'other-signature-tenant');

insert into public.profiles (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  role,
  is_active
)
values (
  '21000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000002',
  'Other',
  'User',
  'signature-other@example.test',
  'ADMIN',
  true
);

insert into public.organization_members (organization_id, profile_id, role)
values (
  '11000000-0000-4000-8000-000000000002',
  '21000000-0000-4000-8000-000000000002',
  'OWNER'
);

insert into public.companies (id, organization_id, name)
values (
  '31000000-0000-4000-8000-000000000002',
  '11000000-0000-4000-8000-000000000002',
  'Other Signature Customer'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000002', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000002","role":"authenticated"}',
  true
);

insert into public.reports (
  id,
  client_request_id,
  organization_id,
  status,
  report_date,
  created_by_user_id,
  created_by_name_snapshot,
  company_id,
  customer_signature
)
values (
  '41000000-0000-4000-8000-000000000005',
  '42000000-0000-4000-8000-000000000005',
  '11000000-0000-4000-8000-000000000002',
  'SUBMITTED',
  '2026-09-06',
  '21000000-0000-4000-8000-000000000002',
  '',
  '31000000-0000-4000-8000-000000000002',
  '{"version":1,"signer_name":"Mehmet Kaya","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[40,0]]]}'::jsonb
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '21000000-0000-4000-8000-000000000001', true);
select set_config('request.jwt.claim.role', 'authenticated', true);
select set_config(
  'request.jwt.claims',
  '{"sub":"21000000-0000-4000-8000-000000000001","role":"authenticated"}',
  true
);

select is(
  (select count(*) from public.reports where id = '41000000-0000-4000-8000-000000000005'),
  0::bigint,
  'signed report remains hidden across tenant boundary'
);

select lives_ok(
  $$
    update public.reports
       set technical_details = 'cross-tenant tamper'
     where id = '41000000-0000-4000-8000-000000000005'
  $$,
  'cross-tenant signed report update is filtered by RLS'
);

reset role;

select is(
  (select technical_details from public.reports where id = '41000000-0000-4000-8000-000000000005'),
  null,
  'cross-tenant update attempt does not mutate signed report'
);

select lives_ok(
  $$
    delete from public.profiles
     where id = '21000000-0000-4000-8000-000000000001'
  $$,
  'personnel profile deletion preserves signed report history through FK nulling'
);

select is(
  (select profile_id from public.report_personnel
    where report_id = '41000000-0000-4000-8000-000000000003'
      and name_snapshot = 'Signature User'),
  null,
  'FK-driven child profile nulling is allowed without changing the signed child snapshot'
);

select is(
  (select customer_signed_by from public.reports where id = '41000000-0000-4000-8000-000000000003'),
  null,
  'FK-driven signature actor nulling is allowed for deleted profile history'
);

select lives_ok(
  $$
    delete from public.reports
     where id = '41000000-0000-4000-8000-000000000003'
  $$,
  'parent report delete can cascade signed child cleanup'
);

select is(
  (select count(*) from public.report_process_types
    where report_id = '41000000-0000-4000-8000-000000000003'),
  0::bigint,
  'parent delete cascades signed process type rows'
);

select is(
  (select count(*) from public.report_photos
    where report_id = '41000000-0000-4000-8000-000000000003'),
  0::bigint,
  'parent delete cascades signed photo metadata'
);

select lives_ok(
  $$
    delete from storage.objects
     where bucket_id = 'report-photos'
       and name = '11000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000003/signature-photo.jpg'
  $$,
  'service cleanup can remove storage object after parent report is gone'
);

select is(
  (select count(*) from storage.objects
    where bucket_id = 'report-photos'
      and name = '11000000-0000-4000-8000-000000000001/41000000-0000-4000-8000-000000000003/signature-photo.jpg'),
  0::bigint,
  'storage object cleanup succeeds after parent report deletion'
);

select * from finish();
rollback;
