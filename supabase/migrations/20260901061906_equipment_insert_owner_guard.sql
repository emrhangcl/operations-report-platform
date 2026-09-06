create policy equipment_insert_owner_guard on public.equipment
as restrictive
for insert
to authenticated
with check (private.is_admin());
