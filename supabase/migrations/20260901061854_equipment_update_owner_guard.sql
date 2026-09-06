create policy equipment_update_owner_guard on public.equipment
as restrictive
for update
to authenticated
using (private.is_admin())
with check (private.is_admin());
