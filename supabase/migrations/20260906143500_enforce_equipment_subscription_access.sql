drop policy if exists subscription_read_access on public.equipment;
create policy subscription_read_access on public.equipment
as restrictive
for select
to authenticated
using (private.has_application_read_access(organization_id));

drop policy if exists subscription_insert_access on public.equipment;
create policy subscription_insert_access on public.equipment
as restrictive
for insert
to authenticated
with check (private.has_application_write_access(organization_id));

drop policy if exists subscription_update_access on public.equipment;
create policy subscription_update_access on public.equipment
as restrictive
for update
to authenticated
using (private.has_application_write_access(organization_id))
with check (private.has_application_write_access(organization_id));

drop policy if exists subscription_delete_access on public.equipment;
create policy subscription_delete_access on public.equipment
as restrictive
for delete
to authenticated
using (private.has_application_write_access(organization_id));
