begin;

alter table public.report_number_counters enable row level security;

revoke all on table public.report_number_counters from public;
revoke all on table public.report_number_counters from anon;
revoke all on table public.report_number_counters from authenticated;

grant all on table public.report_number_counters to service_role;

commit;
