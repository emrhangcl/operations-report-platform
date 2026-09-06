create policy equipment_delete_admin on public.equipment
for delete
to authenticated
using (organization_id = private.current_organization_id());
