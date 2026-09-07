begin;

alter table public.reports
  add column if not exists vehicle_start_km text,
  add column if not exists vehicle_end_km text;

commit;
