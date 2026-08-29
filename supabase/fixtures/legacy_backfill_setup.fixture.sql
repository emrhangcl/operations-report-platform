begin;

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
  '91000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'legacy-backfill@example.test',
  '',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
);

insert into public.profiles (
  id,
  first_name,
  last_name,
  email,
  role,
  is_active
)
values (
  '91000000-0000-4000-8000-000000000001',
  'Legacy',
  'Administrator',
  'legacy-backfill@example.test',
  'ADMIN',
  true
);

insert into public.companies (id, name)
values ('92000000-0000-4000-8000-000000000001', 'Legacy Customer');

insert into public.company_lines (id, company_id, name)
values (
  '93000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'Legacy Line'
);

insert into public.belts (id, name, code)
values (
  '94000000-0000-4000-8000-000000000001',
  'Legacy Belt',
  'LEGACY-BELT-1'
);

insert into public.vehicles (id, plate, description)
values (
  '95000000-0000-4000-8000-000000000001',
  '16TEST16',
  'Legacy migration vehicle'
);

insert into public.reports (
  id,
  client_request_id,
  status,
  report_date,
  created_by_user_id,
  created_by_name_snapshot,
  company_id,
  line_name,
  belt_id
)
values (
  '96000000-0000-4000-8000-000000000001',
  '96100000-0000-4000-8000-000000000001',
  'SUBMITTED',
  '2026-08-29',
  '91000000-0000-4000-8000-000000000001',
  '',
  '92000000-0000-4000-8000-000000000001',
  'Legacy Line',
  '94000000-0000-4000-8000-000000000001'
);

insert into public.report_personnel (report_id, profile_id, name_snapshot)
values (
  '96000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  'Legacy Administrator'
);

insert into public.report_process_types (report_id, value)
values ('96000000-0000-4000-8000-000000000001', 'Legacy Type');

insert into public.report_process_actions (report_id, value)
values ('96000000-0000-4000-8000-000000000001', 'Legacy Action');

insert into public.report_photos (
  id,
  report_id,
  storage_path,
  category,
  created_by
)
values (
  '97000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001/legacy.jpg',
  'report',
  '91000000-0000-4000-8000-000000000001'
);

insert into storage.objects (bucket_id, name, owner_id)
values (
  'report-photos',
  '96000000-0000-4000-8000-000000000001/legacy.jpg',
  '91000000-0000-4000-8000-000000000001'
);

insert into public.installation_assignments (
  id,
  assigned_to_profile_id,
  created_by_profile_id,
  report_id,
  company_id,
  line_name
)
values (
  '98000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  '96000000-0000-4000-8000-000000000001',
  '92000000-0000-4000-8000-000000000001',
  'Legacy Line'
);

insert into public.audit_logs (
  id,
  actor_id,
  action,
  entity_table,
  entity_id
)
values (
  '99000000-0000-4000-8000-000000000001',
  '91000000-0000-4000-8000-000000000001',
  'legacy_test',
  'reports',
  '96000000-0000-4000-8000-000000000001'
);

commit;
