begin;

create index if not exists companies_organization_active_name_idx
  on public.companies (organization_id, is_active, name);

create index if not exists belts_organization_active_code_idx
  on public.belts (organization_id, is_active, code);

create index if not exists company_lines_organization_company_name_idx
  on public.company_lines (organization_id, company_id, name);

create index if not exists vehicles_organization_plate_idx
  on public.vehicles (organization_id, plate);

create index if not exists installation_assignments_organization_status_date_idx
  on public.installation_assignments (organization_id, status, scheduled_date);

create index if not exists profiles_organization_role_active_name_idx
  on public.profiles (organization_id, role, is_active, first_name);

commit;
