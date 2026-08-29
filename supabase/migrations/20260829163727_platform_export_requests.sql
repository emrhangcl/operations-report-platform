begin;

create table if not exists private.platform_export_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  scope text not null default 'organization' check (scope = 'organization'),
  status text not null default 'queued' check (status in ('queued', 'processing', 'completed', 'failed', 'canceled')),
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  artifact_path text,
  error_code text
);

create index if not exists platform_export_requests_organization_idx
  on private.platform_export_requests (organization_id, requested_at desc);

revoke all on table private.platform_export_requests from public, anon, authenticated;
grant all on table private.platform_export_requests to service_role;

create or replace function public.platform_create_export_request(
  target_organization_id uuid,
  target_scope text,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  export_request private.platform_export_requests%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;

  if target_scope <> 'organization' then
    raise exception 'Only organization exports are supported.' using errcode = '22023';
  end if;

  if not exists (select 1 from public.organizations where id = target_organization_id) then
    raise exception 'Organization was not found.' using errcode = 'P0002';
  end if;

  insert into private.platform_export_requests (
    organization_id,
    requested_by_user_id,
    scope
  ) values (
    target_organization_id,
    actor_user_id,
    target_scope
  ) returning * into export_request;

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    entity_table,
    entity_id,
    after_data
  ) values (
    target_organization_id,
    actor_user_id,
    'platform_export_requested',
    'platform_export_requests',
    export_request.id,
    jsonb_build_object('scope', export_request.scope, 'status', export_request.status)
  );

  return jsonb_build_object(
    'id', export_request.id,
    'organization_id', export_request.organization_id,
    'scope', export_request.scope,
    'status', export_request.status,
    'requested_at', export_request.requested_at
  );
end;
$$;

create or replace function public.platform_list_export_requests(
  target_organization_id uuid,
  actor_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
stable
as $$
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'id', requests.id,
        'organization_id', requests.organization_id,
        'scope', requests.scope,
        'status', requests.status,
        'requested_at', requests.requested_at,
        'completed_at', requests.completed_at
      )
      order by requests.requested_at desc
    )
    from private.platform_export_requests as requests
    where requests.organization_id = target_organization_id
  ), '[]'::jsonb);
end;
$$;

revoke execute on function public.platform_create_export_request(uuid, text, uuid)
  from public, anon, authenticated;
revoke execute on function public.platform_list_export_requests(uuid, uuid)
  from public, anon, authenticated;

grant execute on function public.platform_create_export_request(uuid, text, uuid) to service_role;
grant execute on function public.platform_list_export_requests(uuid, uuid) to service_role;

commit;
