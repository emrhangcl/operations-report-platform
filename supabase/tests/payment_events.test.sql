begin;

create extension if not exists pgtap with schema extensions;

select plan(24);

select is(
  has_function_privilege(
    'anon',
    'public.process_verified_payment_event(text,text,text,text,text,text,bigint,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)',
    'execute'
  ),
  false,
  'anonymous users cannot execute the payment event processor'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.process_verified_payment_event(text,text,text,text,text,text,bigint,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)',
    'execute'
  ),
  false,
  'tenant users cannot execute the payment event processor'
);
select ok(
  has_function_privilege(
    'service_role',
    'public.process_verified_payment_event(text,text,text,text,text,text,bigint,text,timestamp with time zone,timestamp with time zone,timestamp with time zone,text)',
    'execute'
  ),
  'only the server service role can execute the payment event processor'
);

insert into public.organizations (id, name, slug, status)
values
  ('71000000-0000-4000-8000-000000000001', 'Payment Success', 'payment-success', 'suspended'),
  ('71000000-0000-4000-8000-000000000002', 'Payment Failure', 'payment-failure', 'active');

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
  '72000000-0000-4000-8000-000000000001',
  'payment_test',
  'Payment Test',
  'TRY',
  10000,
  100000,
  true,
  true
);

insert into public.subscriptions (
  id,
  organization_id,
  plan_id,
  status,
  billing_interval,
  provider,
  provider_subscription_id,
  current_period_starts_at,
  current_period_ends_at
)
values
  (
    '73000000-0000-4000-8000-000000000001',
    '71000000-0000-4000-8000-000000000001',
    '72000000-0000-4000-8000-000000000001',
    'pending',
    'monthly',
    'iyzico',
    'subscription-success',
    null,
    null
  ),
  (
    '73000000-0000-4000-8000-000000000002',
    '71000000-0000-4000-8000-000000000002',
    '72000000-0000-4000-8000-000000000001',
    'active',
    'monthly',
    'paytr',
    'subscription-failure',
    now(),
    now() + interval '30 days'
  );

set local role service_role;

select is(
  (
    public.process_verified_payment_event(
      'iyzico',
      'event-success-1',
      'payment.succeeded',
      null,
      'subscription-success',
      'payment-success-1',
      10000,
      'TRY',
      '2026-08-29T12:00:00Z',
      '2026-08-29T12:00:00Z',
      '2026-09-29T12:00:00Z',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )->>'applied'
  ),
  'true',
  'a verified success activates the subscription'
);
select is(
  (
    select status::text
      from public.subscriptions
     where id = '73000000-0000-4000-8000-000000000001'
  ),
  'active',
  'successful payment stores active subscription status'
);
select is(
  (
    select status::text
      from public.organizations
     where id = '71000000-0000-4000-8000-000000000001'
  ),
  'active',
  'successful payment activates the organization'
);
select is(
  (select count(*) from public.payments where external_payment_id = 'payment-success-1'),
  1::bigint,
  'successful payment is stored once'
);
select is(
  (select count(*) from public.payment_events where external_event_id = 'event-success-1'),
  1::bigint,
  'successful webhook event is stored once'
);
select is(
  (
    select current_period_ends_at
      from public.subscriptions
     where id = '73000000-0000-4000-8000-000000000001'
  ),
  '2026-09-29T12:00:00Z'::timestamptz,
  'successful payment stores the provider period end'
);

select is(
  (
    public.process_verified_payment_event(
      'iyzico',
      'event-success-1',
      'payment.succeeded',
      null,
      'subscription-success',
      'payment-success-1',
      10000,
      'TRY',
      '2026-08-29T12:00:00Z',
      '2026-08-29T12:00:00Z',
      '2026-09-29T12:00:00Z',
      'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    )->>'applied'
  ),
  'false',
  'the same webhook replay is acknowledged without applying again'
);
select is(
  (select count(*) from public.payments where external_payment_id = 'payment-success-1'),
  1::bigint,
  'webhook replay does not create a second payment'
);
select is(
  (
    select current_period_ends_at
      from public.subscriptions
     where id = '73000000-0000-4000-8000-000000000001'
  ),
  '2026-09-29T12:00:00Z'::timestamptz,
  'webhook replay does not extend the period twice'
);
select throws_ok(
  $$
    select public.process_verified_payment_event(
      'iyzico',
      'event-success-1',
      'payment.succeeded',
      null,
      'subscription-success',
      'payment-success-1',
      10000,
      'TRY',
      '2026-08-29T12:00:00Z',
      '2026-08-29T12:00:00Z',
      '2026-09-29T12:00:00Z',
      'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    )
  $$,
  '23514',
  'Payment webhook replay payload does not match.',
  'a replay with a different payload hash is rejected'
);

select is(
  (
    public.process_verified_payment_event(
      'paytr',
      'event-failure-1',
      'payment.failed',
      null,
      'subscription-failure',
      'payment-failure-1',
      10000,
      'TRY',
      '2026-08-29T13:00:00Z',
      null,
      null,
      'cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc'
    )->>'applied'
  ),
  'true',
  'a verified failed payment is recorded'
);
select is(
  (
    select status::text
      from public.subscriptions
     where id = '73000000-0000-4000-8000-000000000002'
  ),
  'past_due',
  'failed payment moves the subscription to past due'
);
select ok(
  (
    select grace_period_ends_at > '2026-08-29T13:00:00Z'::timestamptz
      from public.subscriptions
     where id = '73000000-0000-4000-8000-000000000002'
  ),
  'failed payment starts a seven day grace period'
);
select is(
  (
    select status::text
      from public.payments
     where external_payment_id = 'payment-failure-1'
  ),
  'failed',
  'failed payment stores failed status'
);

select is(
  (
    public.process_verified_payment_event(
      'iyzico',
      'event-refund-1',
      'payment.refunded',
      null,
      'subscription-success',
      'payment-success-1',
      10000,
      'TRY',
      '2026-08-30T12:00:00Z',
      null,
      null,
      'dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd'
    )->>'applied'
  ),
  'true',
  'a verified full refund is recorded'
);
select is(
  (
    select status::text
      from public.payments
     where external_payment_id = 'payment-success-1'
  ),
  'refunded',
  'full refund marks the payment refunded'
);
select is(
  (
    select refunded_amount_minor
      from public.payments
     where external_payment_id = 'payment-success-1'
  ),
  10000::bigint,
  'refund amount is accumulated'
);
select is(
  (
    select status::text
      from public.subscriptions
     where id = '73000000-0000-4000-8000-000000000001'
  ),
  'past_due',
  'full refund prevents indefinite paid access'
);

select is(
  (
    public.process_verified_payment_event(
      'iyzico',
      'event-cancel-1',
      'subscription.canceled',
      null,
      'subscription-success',
      null,
      null,
      null,
      '2026-08-31T12:00:00Z',
      null,
      null,
      'eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
    )->>'applied'
  ),
  'true',
  'a verified cancellation is recorded'
);
select is(
  (
    select status::text
      from public.subscriptions
     where id = '73000000-0000-4000-8000-000000000001'
  ),
  'canceled',
  'cancellation blocks the subscription'
);
select is(
  (
    select status::text
      from public.organizations
     where id = '71000000-0000-4000-8000-000000000001'
  ),
  'suspended',
  'cancellation suspends the organization'
);

select * from finish();
rollback;
