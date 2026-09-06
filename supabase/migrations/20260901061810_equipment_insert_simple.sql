create policy equipment_insert_admin on public.equipment
for insert
to authenticated
with check (organization_id = private.current_organization_id());
