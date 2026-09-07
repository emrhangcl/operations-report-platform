begin;

alter table public.reports
  add column if not exists work_items jsonb not null default '[]'::jsonb;

alter table public.reports
  drop constraint if exists reports_work_items_array;

alter table public.reports
  add constraint reports_work_items_array
  check (jsonb_typeof(work_items) = 'array');

update public.reports
   set work_items = jsonb_build_array(
     jsonb_build_object(
       'line_name', coalesce(line_name, ''),
       'belt_id', coalesce(belt_id::text, ''),
       'belt_code', coalesce(belt_code_snapshot, ''),
       'belt_name', coalesce(belt_name_snapshot, '')
     )
   )
 where work_items = '[]'::jsonb
   and (
     line_name is not null
     or belt_id is not null
     or belt_code_snapshot is not null
     or belt_name_snapshot is not null
   );

commit;
