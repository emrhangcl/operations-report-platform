begin;

do $$
declare
  legacy_prefix constant text := chr(84) || chr(78) || chr(67) || chr(45);
begin
  update public.reports
     set report_number = regexp_replace(report_number, '^' || legacy_prefix, 'RPR-')
   where report_number like legacy_prefix || '%';
end;
$$;

do $$
declare
  function_definition text;
  legacy_prefix constant text := chr(84) || chr(78) || chr(67) || chr(45);
begin
  select pg_get_functiondef('public.prepare_report()'::regprocedure)
    into function_definition;

  if position(legacy_prefix in function_definition) > 0 then
    execute replace(function_definition, legacy_prefix, 'RPR-');
  end if;
end;
$$;

commit;
