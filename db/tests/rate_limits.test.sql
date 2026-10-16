begin;

select plan(17);

select has_table('private', 'rate_limit_buckets', 'rate limit buckets table exists');
select ok(
  (select relrowsecurity from pg_class where oid = 'private.rate_limit_buckets'::regclass),
  'rate limit buckets have row level security enabled'
);
select is(
  has_table_privilege('service_role', 'private.rate_limit_buckets', 'select'),
  false,
  'service role cannot read buckets directly'
);
select is(
  has_function_privilege('authenticated', 'private.consume_rate_limit(text,integer,integer)', 'execute'),
  false,
  'tenant users cannot consume rate limits'
);
select is(
  has_function_privilege('anon', 'private.reset_rate_limit(text)', 'execute'),
  false,
  'anonymous users cannot reset rate limits'
);
select ok(
  has_function_privilege('service_role', 'private.consume_rate_limit(text,integer,integer)', 'execute'),
  'the server service role can consume rate limits'
);

set local role service_role;

select results_eq(
  $$ select is_allowed, current_hits from private.consume_rate_limit('test:login', 2, 60) $$,
  $$ values (true, 1) $$,
  'first hit is allowed'
);
select results_eq(
  $$ select is_allowed, current_hits from private.consume_rate_limit('test:login', 2, 60) $$,
  $$ values (true, 2) $$,
  'hit at the limit is allowed'
);
select results_eq(
  $$ select is_allowed, current_hits from private.consume_rate_limit('test:login', 2, 60) $$,
  $$ values (false, 3) $$,
  'hit over the limit is denied'
);
select ok(
  (select retry_after_seconds between 1 and 60 from private.consume_rate_limit('test:login', 2, 60)),
  'denied hits report when the window ends'
);
select is(private.peek_rate_limit('test:login', 60), 4, 'peek returns the current count');
select is(private.peek_rate_limit('test:other', 60), 0, 'keys are counted separately');
select throws_ok(
  $$ select * from private.consume_rate_limit('test:bad', 0, 60) $$,
  '22023',
  null,
  'invalid limits are rejected'
);

reset role;
update private.rate_limit_buckets
   set window_started_at = now() - interval '61 seconds'
 where key = 'test:login';
set local role service_role;

select is(private.peek_rate_limit('test:login', 60), 0, 'expired windows are not counted');
select results_eq(
  $$ select is_allowed, current_hits from private.consume_rate_limit('test:login', 2, 60) $$,
  $$ values (true, 1) $$,
  'a new window starts after expiry'
);

select private.reset_rate_limit('test:login');
select is(private.peek_rate_limit('test:login', 60), 0, 'reset clears the counter');

reset role;
set local role authenticated;
select throws_ok(
  $$ select * from private.consume_rate_limit('test:login', 1, 60) $$,
  '42501',
  null,
  'tenant users are denied at runtime'
);
reset role;

select * from finish();
rollback;
