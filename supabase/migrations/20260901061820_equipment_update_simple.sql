create policy equipment_update_admin on public.equipment
for update
to authenticated
using (organization_id = private.current_organization_id())
with check (organization_id = private.current_organization_id());
