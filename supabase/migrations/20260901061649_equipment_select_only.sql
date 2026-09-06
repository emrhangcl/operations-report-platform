create policy equipment_select on public.equipment
for select
to authenticated
using (organization_id = private.current_organization_id());
