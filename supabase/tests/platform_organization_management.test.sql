-- Transactional fixtures only: no existing tenant or account is changed.
begin;

do $$
declare
  actor uuid := '94000000-0000-4000-8000-000000000001';
  member_id uuid := '94000000-0000-4000-8000-000000000002';
  main_org uuid := '95000000-0000-4000-8000-000000000001';
  target_org uuid := '95000000-0000-4000-8000-000000000002';
  other_org uuid := '95000000-0000-4000-8000-000000000003';
  company_id uuid := '96000000-0000-4000-8000-000000000001';
  fixture_report_id uuid := '97000000-0000-4000-8000-000000000001';
  manifest jsonb;
begin
  if has_function_privilege('authenticated', 'public.platform_prepare_organization_deletion(uuid,text,uuid)', 'execute')
     or has_function_privilege('anon', 'public.platform_finish_organization_deletion(uuid,uuid)', 'execute')
     or has_function_privilege('authenticated', 'public.platform_purge_organization_data(uuid,uuid)', 'execute') then
    raise exception 'Tenant/anonymous roles must not execute deletion RPCs';
  end if;
  if not has_function_privilege('service_role', 'public.platform_prepare_organization_deletion(uuid,text,uuid)', 'execute') then
    raise exception 'Server service role must be able to execute deletion';
  end if;
  insert into auth.users (id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (actor, 'authenticated', 'authenticated', 'org-review-actor@example.test', '{}', '{}', now(), now()),
         (member_id, 'authenticated', 'authenticated', 'org-review-member@example.test', '{}', '{}', now(), now());
  insert into public.organizations (id, name, slug, status)
  values (main_org, 'Review platform', 'review-platform-20260914', 'active'),
         (target_org, 'Review target', 'review-target-20260914', 'closed'),
         (other_org, 'Review other', 'review-other-20260914', 'active');
  insert into public.profiles (id, organization_id, first_name, last_name, email, role, is_active)
  values (actor, main_org, 'Review', 'Actor', 'org-review-actor@example.test', 'ADMIN', true),
         (member_id, target_org, 'Review', 'Member', 'org-review-member@example.test', 'ADMIN', true);
  insert into private.platform_admins (user_id) values (actor);
  insert into public.organization_members (organization_id, profile_id, role)
  values (main_org, actor, 'OWNER'), (target_org, member_id, 'OWNER');
  insert into public.subscriptions (organization_id, status, billing_interval)
  values (target_org, 'pending', 'monthly');

  begin
    perform public.platform_set_organization_status(target_org, 'active', member_id);
    raise exception 'A tenant administrator reopened an organization';
  exception when insufficient_privilege then null; end;
  perform public.platform_set_organization_status(target_org, 'active', actor);
  if not exists (select 1 from public.organizations where id = target_org and status = 'active' and closed_at is null)
     or not exists (select 1 from public.subscriptions where organization_id = target_org and status = 'pending') then
    raise exception 'Reopen must clear closed_at and preserve the existing subscription';
  end if;
  perform set_config('request.jwt.claim.sub', member_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', member_id, 'role', 'authenticated')::text, true);
  insert into public.companies (id, organization_id, name) values (company_id, target_org, 'Deletion report customer');
  insert into public.reports (id, client_request_id, organization_id, status, report_date,
    created_by_user_id, created_by_name_snapshot, company_id, customer_signature_required)
  values (fixture_report_id, fixture_report_id, target_org, 'DRAFT', current_date, member_id, '', company_id, true);
  insert into public.report_personnel (report_id, organization_id, profile_id, name_snapshot)
  values (fixture_report_id, target_org, member_id, 'Review Member');
  insert into public.report_process_types (report_id, organization_id, value)
  values (fixture_report_id, target_org, 'signed child');
  insert into public.report_photos (report_id, organization_id, storage_path, category, created_by)
  values (fixture_report_id, target_org, target_org::text || '/' || fixture_report_id::text || '/signed-photo.jpg', 'Makine', member_id);
  insert into storage.objects (bucket_id, name, owner_id)
  values ('report-photos', target_org::text || '/' || fixture_report_id::text || '/signed-photo.jpg', member_id::text);
  insert into storage.objects (bucket_id, name, owner_id)
  select 'report-photos', target_org::text || '/manifest-' || object_number || '.jpg', member_id::text
  from generate_series(1, 1001) object_number;
  update public.reports set status = 'SUBMITTED',
    customer_signature = '{"version":1,"signer_name":"Review Signer","signer_title":"Mudur","consent":true,"strokes":[[[0,0],[40,0]]]}'::jsonb
  where id = fixture_report_id;
  perform set_config('request.jwt.claim.sub', actor::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor, 'role', 'authenticated')::text, true);
  begin
    perform public.platform_prepare_organization_deletion(target_org, 'wrong-slug', actor);
    raise exception 'Wrong confirmation was accepted';
  exception when invalid_parameter_value then null; end;
  begin
    perform public.platform_prepare_organization_deletion(main_org, 'review-platform-20260914', actor);
    raise exception 'Own/platform account deletion was accepted';
  exception when check_violation then null; end;
  insert into public.organization_members (organization_id, profile_id, role) values (other_org, member_id, 'ADMIN');
  begin
    perform public.platform_prepare_organization_deletion(target_org, 'review-target-20260914', actor);
    raise exception 'Shared account deletion was accepted';
  exception when check_violation then null; end;
  if exists (select 1 from public.organizations where id = target_org and deletion_started_at is not null) then
    raise exception 'Rejected deletion changed the organization';
  end if;
  delete from public.organization_members where organization_id = other_org and profile_id = member_id;
  manifest := public.platform_prepare_organization_deletion(target_org, 'review-target-20260914', actor);
  if manifest->'user_ids' <> jsonb_build_array(member_id)
     or jsonb_array_length(manifest->'storage_objects') <> 1002
     or exists (select 1 from public.profiles where id = member_id and is_active)
     or exists (select 1 from public.organization_members where organization_id = target_org and is_active) then
    raise exception 'The manifest must include exactly the target account and close access';
  end if;
  if public.platform_prepare_organization_deletion(target_org, 'review-target-20260914', actor)->'user_ids' <> manifest->'user_ids' then
    raise exception 'Retry changed the durable manifest';
  end if;
  begin
    perform public.platform_set_organization_status(target_org, 'active', actor);
    raise exception 'Deleting organization was reopened';
  exception when check_violation then null; end;
  begin
    update public.organizations set deletion_started_at = null where id = target_org;
    raise exception 'Deletion marker was cleared';
  exception when check_violation then null; end;
  begin
    insert into public.organization_members (organization_id, profile_id, role) values (other_org, member_id, 'ADMIN');
    raise exception 'Deleting account was attached to another organization';
  exception when check_violation then null; end;
  begin
    update public.profiles set organization_id = other_org where id = member_id;
    raise exception 'Deleting profile was moved to another organization';
  exception when check_violation then null; end;
  begin
    insert into private.platform_admins (user_id) values (member_id);
    raise exception 'Deleting account was promoted to platform administrator';
  exception when check_violation then null; end;

  perform public.platform_purge_organization_data(target_org, actor);
  if exists (select 1 from public.profiles where id = member_id)
     or exists (select 1 from public.subscriptions where organization_id = target_org) then
    raise exception 'Profile/billing purge was incomplete';
  end if;
  if exists (select 1 from public.reports where id = fixture_report_id)
     or exists (select 1 from public.report_personnel where report_id = fixture_report_id)
     or exists (select 1 from public.report_process_types where report_id = fixture_report_id)
     or exists (select 1 from public.report_photos where report_id = fixture_report_id)
     or not exists (select 1 from storage.objects where bucket_id = 'report-photos' and name = target_org::text || '/' || fixture_report_id::text || '/signed-photo.jpg') then
    raise exception 'Signed report and children must be purged before deleting storage';
  end if;
  if not exists (select 1 from public.audit_logs where organization_id = target_org and action = 'platform_organization_deletion_started') then
    raise exception 'Pending deletion lost its audit trail';
  end if;
  insert into storage.objects (bucket_id, name) values ('organization-logos', target_org::text || '/late-logo.png');
  if jsonb_array_length(public.platform_prepare_organization_deletion(target_org, 'review-target-20260914', actor)->'storage_objects') <> 1003 then
    raise exception 'Retry did not include late same-organization storage';
  end if;
  if not exists (select 1 from auth.users where id = member_id) then
    raise exception 'SQL purge must leave Auth deletion to the admin API';
  end if;
  if public.platform_prepare_organization_deletion(target_org, 'review-target-20260914', actor)->'user_ids' <> manifest->'user_ids' then
    raise exception 'Profile purge lost the Auth manifest';
  end if;
  begin
    perform public.platform_finish_organization_deletion(target_org, actor);
    raise exception 'Deletion finished while an Auth account remained';
  exception when check_violation then null; end;
  -- Emulate the Auth API's completed account deletion inside the rollback fixture.
  -- These objects are metadata-only fixtures and never refer to real stored files.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where split_part(name, '/', 1) = target_org::text;
  delete from auth.users where id = member_id;
  perform public.platform_finish_organization_deletion(target_org, actor);
  if exists (select 1 from public.organizations where id = target_org)
     or exists (select 1 from private.organization_deletion_jobs where organization_id = target_org) then
    raise exception 'Organization/manifest remained after final deletion';
  end if;
  if not exists (select 1 from public.organizations where id = other_org and status = 'active')
     or not exists (select 1 from auth.users where id = actor)
     or not exists (select 1 from private.platform_admins where user_id = actor)
     or not exists (select 1 from public.audit_logs where entity_id = target_org and action = 'platform_organization_deleted' and organization_id is null) then
    raise exception 'Deletion affected the platform/other tenant or lost the final global audit';
  end if;
end;
$$;

rollback;
select '1..1';
select 'ok 1 - reopen and permanent organization deletion safety checks';
