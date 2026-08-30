begin;

create extension if not exists pgtap with schema extensions;

select plan(30);

create temporary table platform_test_baseline as
select count(*)::integer as organization_count
  from public.organizations;

grant select on platform_test_baseline to service_role;

select is(
  has_function_privilege(
    'anon',
    'public.is_platform_admin_for_user(uuid)',
    'execute'
  ),
  false,
  'anonymous users cannot check platform administrator access'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.platform_dashboard_metrics()',
    'execute'
  ),
  false,
  'tenant users cannot execute platform dashboard metrics'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.platform_set_organization_status(uuid,public.organization_status,uuid)',
    'execute'
  ),
  false,
  'tenant users cannot change organization status'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.platform_set_lifetime(uuid,boolean,uuid,public.billing_interval,uuid)',
    'execute'
  ),
  false,
  'tenant users cannot change lifetime access'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.platform_change_plan(uuid,uuid,public.billing_interval,uuid)',
    'execute'
  ),
  false,
  'tenant users cannot change plans'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.platform_dashboard_metrics()',
    'execute'
  ),
  'the server service role can execute platform dashboard metrics'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.platform_set_organization_status(uuid,public.organization_status,uuid)',
    'execute'
  ),
  'the server service role can change organization status'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.platform_set_lifetime(uuid,boolean,uuid,public.billing_interval,uuid)',
    'execute'
  ),
  'the server service role can change lifetime access'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.platform_change_plan(uuid,uuid,public.billing_interval,uuid)',
    'execute'
  ),
  'the server service role can change plans'
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
    '81000000-0000-4000-8000-000000000001',
    'authenticated',
    'authenticated',
    'platform-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '81000000-0000-4000-8000-000000000002',
    'authenticated',
    'authenticated',
    'tenant-admin@example.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

insert into private.platform_admins (user_id, granted_by_user_id)
values (
  '81000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000001'
);

insert into public.organizations (id, name, slug, status, billing_email)
values
  (
    '82000000-0000-4000-8000-000000000001',
    'Platform Test Organization',
    'platform-test-organization',
    'active',
    'billing@example.test'
  ),
  (
    '82000000-0000-4000-8000-000000000002',
    'Empty Test Organization',
    'empty-test-organization',
    'suspended',
    null
  );

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
  '81000000-0000-4000-8000-000000000002',
  '82000000-0000-4000-8000-000000000001',
  'Tenant',
  'Admin',
  'tenant-admin@example.test',
  'ADMIN',
  true
);

insert into public.organization_members (organization_id, profile_id, role)
values (
  '82000000-0000-4000-8000-000000000001',
  '81000000-0000-4000-8000-000000000002',
  'OWNER'
);

insert into public.plans (
  id,
  code,
  name,
  currency,
  monthly_price_minor,
  yearly_price_minor,
  is_active,
  is_public
)
values (
  '83000000-0000-4000-8000-000000000001',
  'platform_test',
  'Platform Test Plan',
  'TRY',
  12000,
  120000,
  true,
  true
);

insert into public.subscriptions (
  organization_id,
  plan_id,
  status,
  billing_interval,
  current_period_starts_at,
  current_period_ends_at
)
values (
  '82000000-0000-4000-8000-000000000001',
  '83000000-0000-4000-8000-000000000001',
  'active',
  'monthly',
  now(),
  now() + interval '30 days'
);

insert into public.payments (
  organization_id,
  provider,
  external_payment_id,
  status,
  amount_minor,
  currency,
  paid_at
)
values (
  '82000000-0000-4000-8000-000000000001',
  'test-provider',
  'platform-payment-1',
  'succeeded',
  12000,
  'TRY',
  now()
), (
  '82000000-0000-4000-8000-000000000001',
  'test-provider',
  'platform-payment-2',
  'pending',
  12000,
  'TRY',
  null
);

insert into public.payment_events (
  organization_id,
  provider,
  external_event_id,
  event_type,
  signature_verified,
  payload_hash,
  processing_error
)
values (
  '82000000-0000-4000-8000-000000000001',
  'test-provider',
  'platform-event-1',
  'payment.failed',
  true,
  'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
  'temporary test failure'
);

set local role service_role;

select ok(
  public.is_platform_admin_for_user('81000000-0000-4000-8000-000000000001'),
  'the platform administrator is resolved from the private table'
);
select is(
  public.is_platform_admin_for_user('81000000-0000-4000-8000-000000000002'),
  false,
  'a tenant administrator is not a platform administrator'
);
select is(
  (public.platform_dashboard_metrics()->>'total_organizations')::integer,
  2 + (select organization_count from platform_test_baseline),
  'dashboard counts real organizations'
);
select is(
  (public.platform_dashboard_metrics()->>'active_subscriptions')::integer,
  1,
  'dashboard counts real active subscriptions'
);
select is(
  (public.platform_dashboard_metrics()->>'mrr_minor')::integer,
  12000,
  'dashboard calculates MRR from the selected plan price'
);
select is(
  (public.platform_dashboard_metrics()->>'successful_collected_minor')::integer,
  12000,
  'dashboard counts only successful collected payments'
);
select is(
  (public.platform_dashboard_metrics()->>'pending_payments')::integer,
  1,
  'dashboard counts pending payments'
);
select is(
  (public.platform_dashboard_metrics()->>'payment_error_count')::integer,
  1,
  'dashboard counts payment processing errors'
);

select is(
  (
    public.platform_set_organization_status(
      '82000000-0000-4000-8000-000000000001',
      'suspended',
      '81000000-0000-4000-8000-000000000001'
    )->>'status'
  ),
  'suspended',
  'platform administrator can suspend an organization'
);
select is(
  (
    select status::text
      from public.organizations
     where id = '82000000-0000-4000-8000-000000000001'
  ),
  'suspended',
  'organization suspension is persisted'
);
select is(
  (
    select action
      from public.audit_logs
     where organization_id = '82000000-0000-4000-8000-000000000001'
     order by created_at desc
     limit 1
  ),
  'platform_organization_suspended',
  'organization suspension creates an audit log'
);

select is(
  (
    public.platform_create_export_request(
      '82000000-0000-4000-8000-000000000001',
      'organization',
      '81000000-0000-4000-8000-000000000001'
    )->>'status'
  ),
  'queued',
  'platform administrator can queue an organization export request'
);
select is(
  (
    select count(*)
      from private.platform_export_requests
     where organization_id = '82000000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'export request is stored outside the public tenant schema'
);
select is(
  jsonb_array_length(
    public.platform_list_export_requests(
      '82000000-0000-4000-8000-000000000001',
      '81000000-0000-4000-8000-000000000001'
    )
  ),
  1,
  'platform administrator can list export requests for one organization'
);

select is(
  (
    public.platform_set_lifetime(
      '82000000-0000-4000-8000-000000000001',
      true,
      null,
      'lifetime',
      '81000000-0000-4000-8000-000000000001'
    )->>'status'
  ),
  'lifetime',
  'platform administrator can grant lifetime access'
);
select is(
  (
    select status::text
      from public.subscriptions
     where organization_id = '82000000-0000-4000-8000-000000000001'
       and is_current
  ),
  'lifetime',
  'lifetime status is persisted on the current subscription'
);
select is(
  (
    select status::text
      from public.organizations
     where id = '82000000-0000-4000-8000-000000000001'
  ),
  'active',
  'granting lifetime access activates the organization'
);
select is(
  (
    select count(*)
      from public.audit_logs
     where organization_id = '82000000-0000-4000-8000-000000000001'
       and action = 'platform_lifetime_granted'
  ),
  1::bigint,
  'lifetime grant creates an audit log'
);

select is(
  (
    public.platform_change_plan(
      '82000000-0000-4000-8000-000000000001',
      '83000000-0000-4000-8000-000000000001',
      'yearly',
      '81000000-0000-4000-8000-000000000001'
    )->>'status'
  ),
  'pending',
  'platform administrator can move an organization to a paid plan'
);
select is(
  (
    select billing_interval::text
      from public.subscriptions
     where organization_id = '82000000-0000-4000-8000-000000000001'
       and is_current
  ),
  'yearly',
  'plan change stores the selected billing interval'
);
select is(
  (
    select count(*)
      from public.audit_logs
     where organization_id = '82000000-0000-4000-8000-000000000001'
       and action = 'platform_plan_changed'
  ),
  1::bigint,
  'plan change creates an audit log'
);

select * from finish();
rollback;
