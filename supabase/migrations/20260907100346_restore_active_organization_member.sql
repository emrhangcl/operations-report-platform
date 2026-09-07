create or replace function private.is_active_organization_member(target_organization_id uuid)
returns boolean
language sql
security definer
set search_path = public, private
stable
as $$
  select private.is_organization_member(target_organization_id)
    and exists (
      select 1
        from public.organizations
       where id = target_organization_id
         and status = 'active'
    );
$$;

revoke execute on function private.is_active_organization_member(uuid) from public, anon;
grant execute on function private.is_active_organization_member(uuid) to authenticated, service_role;
