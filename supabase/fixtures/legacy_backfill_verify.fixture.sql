do $$
declare
  imported_organization_id uuid;
  tenant_table record;
begin
  if (select count(*) from public.organizations) <> 1 then
    raise exception 'Expected exactly one migrated organization.';
  end if;

  select id
    into strict imported_organization_id
    from public.organizations
   where slug = 'imported-workspace'
     and name = 'İçe Aktarılan Çalışma Alanı'
     and status = 'active';

  for tenant_table in
    select *
      from (
        values
          ('profiles', (select count(*) from public.profiles where organization_id is distinct from imported_organization_id)),
          ('companies', (select count(*) from public.companies where organization_id is distinct from imported_organization_id)),
          ('belts', (select count(*) from public.belts where organization_id is distinct from imported_organization_id)),
          ('company_lines', (select count(*) from public.company_lines where organization_id is distinct from imported_organization_id)),
          ('vehicles', (select count(*) from public.vehicles where organization_id is distinct from imported_organization_id)),
          ('reports', (select count(*) from public.reports where organization_id is distinct from imported_organization_id)),
          ('report_personnel', (select count(*) from public.report_personnel where organization_id is distinct from imported_organization_id)),
          ('report_process_types', (select count(*) from public.report_process_types where organization_id is distinct from imported_organization_id)),
          ('report_process_actions', (select count(*) from public.report_process_actions where organization_id is distinct from imported_organization_id)),
          ('report_photos', (select count(*) from public.report_photos where organization_id is distinct from imported_organization_id)),
          ('installation_assignments', (select count(*) from public.installation_assignments where organization_id is distinct from imported_organization_id)),
          ('report_number_counters', (select count(*) from public.report_number_counters where organization_id is distinct from imported_organization_id)),
          ('audit_logs', (select count(*) from public.audit_logs where organization_id is distinct from imported_organization_id))
      ) as tenant_tables(table_name, mismatched_rows)
  loop
    if tenant_table.mismatched_rows <> 0 then
      raise exception 'Table % has % rows outside imported workspace.', tenant_table.table_name, tenant_table.mismatched_rows;
    end if;
  end loop;

  if not exists (
    select 1
      from public.organization_members
     where organization_id = imported_organization_id
       and profile_id = '91000000-0000-4000-8000-000000000001'
       and role = 'ADMIN'
       and is_active
  ) then
    raise exception 'Legacy administrator membership was not migrated.';
  end if;

  if (
    select count(*)
      from public.subscriptions
     where organization_id = imported_organization_id
       and status = 'lifetime'
       and billing_interval = 'lifetime'
  ) <> 1 then
    raise exception 'Expected exactly one lifetime subscription.';
  end if;

  if (
    select report_number
      from public.reports
     where id = '96000000-0000-4000-8000-000000000001'
  ) <> 'RPR-2026-000001' then
    raise exception 'Legacy report number changed during migration.';
  end if;

  if (
    select storage_path
      from public.report_photos
     where id = '97000000-0000-4000-8000-000000000001'
  ) <> '96000000-0000-4000-8000-000000000001/legacy.jpg' then
    raise exception 'Legacy photo metadata path changed during migration.';
  end if;

  if not exists (
    select 1
      from storage.objects
     where bucket_id = 'report-photos'
       and name = '96000000-0000-4000-8000-000000000001/legacy.jpg'
  ) then
    raise exception 'Legacy storage object was not preserved.';
  end if;
end
$$;

select 'legacy backfill verification passed' as result;
