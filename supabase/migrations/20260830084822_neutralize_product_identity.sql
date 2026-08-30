begin;

update public.reports
   set report_number = regexp_replace(report_number, '^TNC-', 'RPR-')
 where report_number like 'TNC-%';

do $$
declare
  function_definition text;
begin
  select pg_get_functiondef('public.prepare_report()'::regprocedure)
    into function_definition;

  if position('TNC-' in function_definition) > 0 then
    execute replace(function_definition, 'TNC-', 'RPR-');
  end if;
end;
$$;

commit;
