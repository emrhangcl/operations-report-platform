-- Uygulama semasi (konsolide temel).
--
-- Bu dosya eski Supabase donemindeki 40 migration'in (supabase/migrations, son commit eae4209)
-- 0001_platform_foundation uzerine uygulanmasiyla olusan son durumun birebir karsiligidir.
-- Tablolar, tipler, fonksiyonlar, tetikleyiciler, RLS politikalari ve yetkiler tek seferde kurulur.
-- Bu dosyadan sonra her sema degisikligi yeni bir migration dosyasi olarak eklenmelidir.

set local check_function_bodies = false;
set local search_path = '';

CREATE TYPE public.billing_interval AS ENUM (
    'monthly',
    'yearly',
    'lifetime'
);

CREATE TYPE public.installation_assignment_status AS ENUM (
    'DRAFT',
    'ASSIGNED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);

CREATE TYPE public.invoice_status AS ENUM (
    'draft',
    'open',
    'paid',
    'void',
    'uncollectible'
);

CREATE TYPE public.organization_member_role AS ENUM (
    'OWNER',
    'ADMIN',
    'PERSONNEL'
);

CREATE TYPE public.organization_status AS ENUM (
    'active',
    'suspended',
    'closed'
);

CREATE TYPE public.payment_status AS ENUM (
    'pending',
    'succeeded',
    'failed',
    'refunded',
    'canceled'
);

CREATE TYPE public.report_status AS ENUM (
    'DRAFT',
    'SUBMITTED'
);

CREATE TYPE public.subscription_status AS ENUM (
    'pending',
    'active',
    'past_due',
    'grace_period',
    'read_only',
    'canceled',
    'lifetime'
);

CREATE TYPE public.user_role AS ENUM (
    'ADMIN',
    'PERSONNEL'
);

CREATE FUNCTION private.current_organization_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select organization_id
    from public.profiles
   where id = (select auth.uid());
$$;

CREATE FUNCTION private.current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role
    from public.profiles
   where id = (select auth.uid());
$$;

CREATE FUNCTION private.entitlement(target_organization_id uuid, entitlement_code text) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with selected_entitlement as (
    select entitlements.enabled, entitlements.value, 0 as priority
      from public.entitlements
     where entitlements.organization_id = target_organization_id
       and entitlements.code = entitlement_code
    union all
    select entitlements.enabled, entitlements.value, 1 as priority
      from public.subscriptions
      join public.entitlements
        on entitlements.plan_id = subscriptions.plan_id
     where subscriptions.organization_id = target_organization_id
       and subscriptions.is_current
       and entitlements.code = entitlement_code
  )
  select jsonb_build_object('enabled', enabled, 'value', value)
    from selected_entitlement
   order by priority
   limit 1;
$$;

CREATE FUNCTION private.guard_deletion_identity_changes() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  candidate_user_id uuid;
begin
  if tg_table_name = 'profiles' then candidate_user_id := new.id;
  elsif tg_table_name = 'platform_admins' then candidate_user_id := new.user_id;
  else candidate_user_id := new.profile_id; end if;
  -- These locks make a transfer/insert serialize with the manifest snapshot.
  perform 1 from public.profiles where id = candidate_user_id for update;
  if tg_table_name = 'platform_admins' then
    if exists (select 1 from private.organization_deletion_jobs where candidate_user_id = any(user_ids)) then
      raise exception 'organization_deletion_pending' using errcode = '23514';
    end if;
    return new;
  end if;
  perform 1 from public.organizations where id = new.organization_id for share;
  if exists (select 1 from public.organizations where id = new.organization_id and deletion_started_at is not null)
     or exists (select 1 from private.organization_deletion_jobs where candidate_user_id = any(user_ids)) then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  if tg_op = 'UPDATE' and exists (
    select 1 from public.organizations where id = old.organization_id and deletion_started_at is not null
  ) then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  return new;
end;
$$;

CREATE FUNCTION private.guard_organization_deletion_state() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO ''
    AS $$
begin
  if old.deletion_started_at is not null and
    (new.deletion_started_at is distinct from old.deletion_started_at or new.status <> 'closed') then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  return new;
end;
$$;

CREATE FUNCTION private.has_application_read_access(target_organization_id uuid, evaluated_at timestamp with time zone DEFAULT now()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'private'
    AS $$
  select private.is_organization_member(target_organization_id)
    and coalesce(private.subscription_access_mode(target_organization_id, evaluated_at), 'blocked')
      in ('read', 'write');
$$;

CREATE FUNCTION private.has_application_write_access(target_organization_id uuid, evaluated_at timestamp with time zone DEFAULT now()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'private'
    AS $$
  select private.is_organization_member(target_organization_id)
    and coalesce(private.subscription_access_mode(target_organization_id, evaluated_at), 'blocked') = 'write';
$$;

CREATE FUNCTION private.has_entitlement(target_organization_id uuid, entitlement_code text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'private'
    AS $$
  select coalesce((private.entitlement(target_organization_id, entitlement_code) ->> 'enabled')::boolean, false);
$$;

CREATE FUNCTION private.has_organization_role(target_organization_id uuid, allowed_roles public.organization_member_role[]) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
      from public.organization_members
      join public.profiles
        on profiles.id = organization_members.profile_id
     where organization_members.organization_id = target_organization_id
       and organization_members.profile_id = (select auth.uid())
       and organization_members.role = any(allowed_roles)
       and organization_members.is_active
       and profiles.is_active
       and profiles.organization_id = organization_members.organization_id
  );
$$;

CREATE FUNCTION private.is_active_organization_member(target_organization_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
  select private.is_organization_member(target_organization_id)
    and exists (
      select 1
        from public.organizations
       where id = target_organization_id
         and status = 'active'
    );
$$;

CREATE FUNCTION private.is_active_profile() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'private'
    AS $$
  select private.is_active_organization_member(private.current_organization_id());
$$;

CREATE FUNCTION private.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
  select private.is_active_organization_member(private.current_organization_id())
    and private.has_organization_role(
      private.current_organization_id(),
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    );
$$;

CREATE FUNCTION private.is_organization_member(target_organization_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
      from public.organization_members
      join public.profiles
        on profiles.id = organization_members.profile_id
      join public.organizations
        on organizations.id = organization_members.organization_id
     where organization_members.organization_id = target_organization_id
       and organization_members.profile_id = (select auth.uid())
       and organization_members.is_active
       and profiles.is_active
       and profiles.organization_id = organization_members.organization_id
       and organizations.status <> 'closed'
  );
$$;

CREATE FUNCTION private.is_platform_admin(candidate_user_id uuid DEFAULT auth.uid()) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'private'
    AS $$
  select candidate_user_id is not null
    and exists (
      select 1
        from private.platform_admins
       where user_id = candidate_user_id
    );
$$;

CREATE FUNCTION private.prepare_report_photo() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  parent_organization_id uuid;
  creator_organization_id uuid;
begin
  select organization_id
    into parent_organization_id
    from public.reports
   where id = new.report_id;

  if parent_organization_id is null then
    raise exception 'Fotoğraf için geçerli rapor bulunamadı.';
  end if;

  if new.created_by is not null then
    select organization_id
      into creator_organization_id
      from public.profiles
     where id = new.created_by;

    if creator_organization_id is distinct from parent_organization_id then
      raise exception 'Başka firmaya ait kullanıcı fotoğraf ekleyemez.';
    end if;
  end if;

  if split_part(new.storage_path, '/', 1) <> parent_organization_id::text
    or split_part(new.storage_path, '/', 2) <> new.report_id::text
    or split_part(new.storage_path, '/', 3) = '' then
    raise exception 'Fotoğraf yolu organization_id/report_id/file biçiminde olmalıdır.';
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Fotoğraf organizasyonu değiştirilemez.';
  end if;

  new.organization_id = parent_organization_id;
  return new;
end;
$$;

CREATE FUNCTION private.set_company_line_organization() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  parent_organization_id uuid;
begin
  select organization_id
    into parent_organization_id
    from public.companies
   where id = new.company_id;

  if parent_organization_id is null then
    raise exception 'Hat için geçerli firma bulunamadı.';
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Hat organizasyonu değiştirilemez.';
  end if;

  new.organization_id = parent_organization_id;
  return new;
end;
$$;

CREATE FUNCTION private.set_report_child_organization() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  parent_organization_id uuid;
  linked_profile_organization_id uuid;
begin
  select organization_id
    into parent_organization_id
    from public.reports
   where id = new.report_id;

  if parent_organization_id is null then
    raise exception 'Rapor alt kaydı için geçerli rapor bulunamadı.';
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Rapor alt kaydının organizasyonu değiştirilemez.';
  end if;

  if tg_table_name = 'report_personnel' and new.profile_id is not null then
    select organization_id
      into linked_profile_organization_id
      from public.profiles
     where id = new.profile_id;

    if linked_profile_organization_id is distinct from parent_organization_id then
      raise exception 'Başka firmaya ait personel rapora eklenemez.';
    end if;
  end if;

  new.organization_id = parent_organization_id;
  return new;
end;
$$;

CREATE FUNCTION private.storage_organization_id(object_name text) RETURNS uuid
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'storage'
    AS $_$
declare
  organization_segment text;
begin
  organization_segment = (storage.foldername(object_name))[1];

  if organization_segment is null
    or organization_segment !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return null;
  end if;

  return organization_segment::uuid;
end;
$_$;

CREATE FUNCTION private.subscription_access_mode(target_organization_id uuid, evaluated_at timestamp with time zone DEFAULT now()) RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select case
    when organizations.status <> 'active' then 'blocked'
    when subscriptions.status = 'lifetime' then 'write'
    when subscriptions.status = 'active'
      and (
        subscriptions.current_period_ends_at is null
        or subscriptions.current_period_ends_at > evaluated_at
      ) then 'write'
    when subscriptions.status = 'active'
      and evaluated_at < coalesce(
        subscriptions.grace_period_ends_at,
        subscriptions.current_period_ends_at + interval '7 days'
      ) then 'write'
    when subscriptions.status in ('past_due', 'grace_period')
      and evaluated_at < coalesce(
        subscriptions.grace_period_ends_at,
        subscriptions.updated_at + interval '7 days'
      ) then 'write'
    when subscriptions.status in ('active', 'past_due', 'grace_period', 'read_only') then 'read'
    else 'blocked'
  end
    from public.organizations
    left join public.subscriptions
      on subscriptions.organization_id = organizations.id
     and subscriptions.is_current
   where organizations.id = target_organization_id
   limit 1;
$$;

CREATE FUNCTION public.current_user_role() RETURNS public.user_role
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select role from public.profiles where id = auth.uid();
$$;

CREATE FUNCTION public.get_user_access_context(candidate_user_id uuid, evaluated_at timestamp with time zone DEFAULT now()) RETURNS TABLE(organization_id uuid, organization_name text, organization_logo_path text, profile_is_active boolean, member_role text, membership_is_active boolean, organization_status text, subscription_status text, billing_interval text, current_period_ends_at timestamp with time zone, grace_period_ends_at timestamp with time zone, subscription_updated_at timestamp with time zone, access_mode text)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO ''
    AS $$
  select
    profiles.organization_id,
    organizations.name,
    organizations.logo_path,
    profiles.is_active,
    organization_members.role::text,
    organization_members.is_active,
    organizations.status::text,
    subscriptions.status::text,
    subscriptions.billing_interval::text,
    subscriptions.current_period_ends_at,
    subscriptions.grace_period_ends_at,
    subscriptions.updated_at,
    case
      when organizations.status <> 'active' then 'blocked'
      when subscriptions.status = 'lifetime' then 'write'
      when subscriptions.status = 'active'
        and (
          subscriptions.current_period_ends_at is null
          or subscriptions.current_period_ends_at > evaluated_at
        ) then 'write'
      when subscriptions.status = 'active'
        and evaluated_at < coalesce(
          subscriptions.grace_period_ends_at,
          subscriptions.current_period_ends_at + interval '7 days'
        ) then 'write'
      when subscriptions.status in ('past_due', 'grace_period')
        and evaluated_at < coalesce(
          subscriptions.grace_period_ends_at,
          subscriptions.updated_at + interval '7 days'
        ) then 'write'
      when subscriptions.status in ('active', 'past_due', 'grace_period', 'read_only') then 'read'
      else 'blocked'
    end
  from public.profiles
  join public.organizations
    on organizations.id = profiles.organization_id
  left join public.organization_members
    on organization_members.organization_id = profiles.organization_id
   and organization_members.profile_id = profiles.id
  left join public.subscriptions
    on subscriptions.organization_id = profiles.organization_id
   and subscriptions.is_current
  where profiles.id = candidate_user_id
  limit 1;
$$;

CREATE FUNCTION public.guard_customer_signature() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  submitting boolean;
  signed_report_locked boolean;
  return_closeout_changed boolean := false;
  fk_nulling boolean := pg_trigger_depth() > 1;
begin
  submitting := new.status = 'SUBMITTED'::public.report_status
    and (
      tg_op = 'INSERT'
      or (tg_op = 'UPDATE' and old.status is distinct from 'SUBMITTED'::public.report_status)
    );
  signed_report_locked := tg_op = 'UPDATE'
    and old.status = 'SUBMITTED'::public.report_status
    and old.customer_signature is not null;
  return_closeout_changed := tg_op = 'UPDATE'
    and (
      new.factory_return_at is distinct from old.factory_return_at
      or new.vehicle_end_km is distinct from old.vehicle_end_km
    );

  if new.status = 'DRAFT'::public.report_status
     and (
       new.customer_signature is not null
       or new.customer_signed_at is not null
       or new.customer_signed_by is not null
     ) then
    raise exception 'Taslak raporda müşteri imza bilgisi bulunamaz.';
  end if;

  if submitting then
    if new.customer_signature_required or new.customer_signature is not null then
      if not public.validate_customer_signature(new.customer_signature) then
        raise exception 'Gönderim için geçerli müşteri yetkilisi imzası zorunludur.';
      end if;

      if (select auth.uid()) is null
         or not exists (
           select 1
           from public.profiles
           where id = (select auth.uid())
         ) then
        raise exception 'Müşteri imzası için geçerli işlem yapan kullanıcı zorunludur.';
      end if;

      new.customer_signed_at := now();
      new.customer_signed_by := (select auth.uid());
    else
      new.customer_signed_at := null;
      new.customer_signed_by := null;
    end if;
  elsif new.customer_signature is not null
        and not public.validate_customer_signature(new.customer_signature) then
    raise exception 'Müşteri imzası geçersiz.';
  end if;

  if tg_op = 'UPDATE'
     and old.customer_signature_required
     and not new.customer_signature_required then
    raise exception 'Müşteri imza zorunluluğu rapora işlendikten sonra kaldırılamaz.';
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'SUBMITTED'::public.report_status
     and old.customer_signature is null
     and (
       new.customer_signature is not null
       or new.customer_signed_at is not null
       or new.customer_signed_by is not null
       or new.customer_signature_required
     ) then
    raise exception 'Eski gönderilmiş rapora sonradan müşteri imzası eklenemez.';
  end if;

  if signed_report_locked then
    if new.customer_signature is distinct from old.customer_signature then
      raise exception 'Müşteri imzası gönderimden sonra değiştirilemez.';
    end if;

    if new.customer_signed_at is distinct from old.customer_signed_at then
      raise exception 'İmza zamanı gönderimden sonra değiştirilemez.';
    end if;

    if new.customer_signed_by is distinct from old.customer_signed_by
       and not (fk_nulling and old.customer_signed_by is not null and new.customer_signed_by is null) then
      raise exception 'İmzayı kaydeden kullanıcı gönderimden sonra değiştirilemez.';
    end if;

    if new.created_by_user_id is distinct from old.created_by_user_id
       and not (fk_nulling and old.created_by_user_id is not null and new.created_by_user_id is null) then
      raise exception 'İmzalı raporun personel kaydı değiştirilemez.';
    end if;

    if new.belt_id is distinct from old.belt_id
       and not (fk_nulling and old.belt_id is not null and new.belt_id is null) then
      raise exception 'İmzalı raporun bant kaydı değiştirilemez.';
    end if;

    if new.observer_personnel_id is distinct from old.observer_personnel_id
       and not (fk_nulling and old.observer_personnel_id is not null and new.observer_personnel_id is null) then
      raise exception 'İmzalı raporun gözlemci personel kaydı değiştirilemez.';
    end if;

    if (to_jsonb(new) - array[
          'updated_at',
          'created_by_user_id',
          'belt_id',
          'observer_personnel_id',
          'updated_by_user_id',
          'customer_signed_by',
          'factory_return_at',
          'vehicle_end_km'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'updated_at',
          'created_by_user_id',
          'belt_id',
          'observer_personnel_id',
          'updated_by_user_id',
          'customer_signed_by',
          'factory_return_at',
          'vehicle_end_km'
    ]) then
      raise exception 'İmzalı rapor içeriği gönderimden sonra değiştirilemez.';
    end if;

    if new.updated_by_user_id is distinct from old.updated_by_user_id
       and not return_closeout_changed
       and not (fk_nulling and old.updated_by_user_id is not null and new.updated_by_user_id is null) then
      raise exception 'İmzalı raporun güncelleyen kullanıcı kaydı değiştirilemez.';
    end if;
  end if;

  return new;
end;
$$;

COMMENT ON FUNCTION public.guard_customer_signature() IS 'Locks customer-approved report content after submission while permitting audited updates to factory_return_at and vehicle_end_km as post-service return closeout data.';

CREATE FUNCTION public.guard_installation_assignment_personnel_update() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public', 'private'
    AS $$
begin
  if private.is_admin() then
    return new;
  end if;

  if auth.uid() is null or old.assigned_to_profile_id <> auth.uid() then
    raise exception 'Bu montaj ataması güncellenemez.';
  end if;

  if new.id is distinct from old.id
    or new.organization_id is distinct from old.organization_id
    or new.title is distinct from old.title
    or new.assigned_to_profile_id is distinct from old.assigned_to_profile_id
    or new.created_by_profile_id is distinct from old.created_by_profile_id
    or new.scheduled_date is distinct from old.scheduled_date
    or new.notes is distinct from old.notes
    or new.company_id is distinct from old.company_id
    or new.company_name_snapshot is distinct from old.company_name_snapshot
    or new.line_name is distinct from old.line_name
    or new.report_values is distinct from old.report_values
    or new.cancelled_at is distinct from old.cancelled_at
    or new.created_at is distinct from old.created_at then
    raise exception 'Personel montaj atamasının plan bilgisini değiştiremez.';
  end if;

  if new.status not in ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED') then
    raise exception 'Personel bu montaj durumuna geçemez.';
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.guard_signed_report_child_rows() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
declare
  fk_nulling boolean := false;
  target_report_ids uuid[];
begin
  if tg_op = 'DELETE' then
    if pg_trigger_depth() > 1
       and not exists (
         select 1
         from public.reports
         where id = old.report_id
       ) then
      return old;
    end if;

    if exists (
      select 1
      from public.reports
      where id = old.report_id
        and status = 'SUBMITTED'::public.report_status
        and customer_signature is not null
    ) then
      raise exception 'İmzalı raporun detay kayıtları gönderimden sonra silinemez.';
    end if;

    return old;
  end if;

  if tg_op = 'UPDATE' then
    target_report_ids := array[old.report_id, new.report_id];
  else
    target_report_ids := array[new.report_id];
  end if;

  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and old.report_id is not distinct from new.report_id then
    fk_nulling := (
      tg_table_name = 'report_personnel'
      and old.profile_id is not null
      and new.profile_id is null
      and (to_jsonb(new) - 'profile_id') is not distinct from (to_jsonb(old) - 'profile_id')
    ) or (
      tg_table_name = 'report_photos'
      and old.created_by is not null
      and new.created_by is null
      and (to_jsonb(new) - 'created_by') is not distinct from (to_jsonb(old) - 'created_by')
    );
  end if;

  if fk_nulling then
    return new;
  end if;

  if exists (
    select 1
    from public.reports
    where id = any(target_report_ids)
      and status = 'SUBMITTED'::public.report_status
      and customer_signature is not null
  ) then
    raise exception 'İmzalı raporun detay kayıtları gönderimden sonra değiştirilemez.';
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.is_active_profile() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce((select is_active from public.profiles where id = auth.uid()), false);
$$;

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select coalesce(public.current_user_role() = 'ADMIN', false);
$$;

CREATE FUNCTION public.is_platform_admin_for_user(candidate_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'private'
    AS $$
  select private.is_platform_admin(candidate_user_id);
$$;

CREATE FUNCTION public.log_admin_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
declare
  action_name text;
  entity_data jsonb;
  entity_organization_id uuid;
begin
  entity_data = case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  entity_organization_id = nullif(entity_data ->> 'organization_id', '')::uuid;

  if entity_organization_id is null
    or not private.has_organization_role(
      entity_organization_id,
      array['OWNER', 'ADMIN']::public.organization_member_role[]
    ) then
    return coalesce(new, old);
  end if;

  action_name = lower(tg_table_name) || '_' || lower(tg_op);

  insert into public.audit_logs (
    organization_id,
    actor_id,
    action,
    entity_table,
    entity_id,
    before_data,
    after_data
  )
  values (
    entity_organization_id,
    auth.uid(),
    action_name,
    tg_table_name,
    coalesce(new.id, old.id),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end
  );

  return coalesce(new, old);
end;
$$;

CREATE FUNCTION public.platform_change_plan(target_organization_id uuid, target_plan_id uuid, target_billing_interval public.billing_interval, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
declare
  target_organization public.organizations%rowtype;
  selected_subscription public.subscriptions%rowtype;
  selected_plan public.plans%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;

  if target_billing_interval not in ('monthly', 'yearly') then
    raise exception 'Only monthly and yearly plans can be assigned.' using errcode = '22023';
  end if;

  select * into target_organization from public.organizations where id = target_organization_id for update;
  if not found then
    raise exception 'Organization was not found.' using errcode = 'P0002';
  end if;
  if target_organization.status = 'closed' then
    raise exception 'A closed organization cannot be changed.' using errcode = '22023';
  end if;

  select * into selected_plan from public.plans where id = target_plan_id and is_active;
  if not found then
    raise exception 'The selected plan is not available.' using errcode = '22023';
  end if;

  select *
    into selected_subscription
    from public.subscriptions
   where organization_id = target_organization_id
     and is_current
   for update;

  if selected_subscription.id is null then
    insert into public.subscriptions (
      organization_id, plan_id, status, billing_interval
    ) values (
      target_organization_id, target_plan_id, 'pending', target_billing_interval
    )
    returning * into selected_subscription;
  else
    update public.subscriptions
       set plan_id = target_plan_id,
           status = 'pending'::public.subscription_status,
           billing_interval = target_billing_interval,
           provider = null,
           provider_customer_id = null,
           provider_subscription_id = null,
           starts_at = null,
           current_period_starts_at = null,
           current_period_ends_at = null,
           grace_period_ends_at = null,
           canceled_at = null
     where id = selected_subscription.id;
  end if;

  update public.organizations
     set status = 'suspended'::public.organization_status
   where id = target_organization_id;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_table, entity_id, after_data
  ) values (
    target_organization_id,
    actor_user_id,
    'platform_plan_changed',
    'subscriptions',
    selected_subscription.id,
    jsonb_build_object('status', 'pending', 'plan_id', selected_plan.id, 'billing_interval', target_billing_interval)
  );

  return jsonb_build_object(
    'organization_id', target_organization_id,
    'status', 'pending',
    'plan_id', selected_plan.id,
    'billing_interval', target_billing_interval
  );
end;
$$;

CREATE FUNCTION public.platform_create_export_request(target_organization_id uuid, target_scope text, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
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

CREATE FUNCTION public.platform_dashboard_metrics() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  with current_subscriptions as (
    select subscriptions.*, plans.name as plan_name, plans.monthly_price_minor, plans.yearly_price_minor
      from public.subscriptions
      left join public.plans on plans.id = subscriptions.plan_id
     where subscriptions.is_current
  ),
  plan_distribution as (
    select coalesce(plan_name, 'Paket seçilmedi') as plan_name, count(*)::bigint as organization_count
      from current_subscriptions
     group by coalesce(plan_name, 'Paket seçilmedi')
     order by organization_count desc, plan_name
  )
  select jsonb_build_object(
    'total_organizations', (select count(*) from public.organizations),
    'active_subscriptions', (select count(*) from current_subscriptions where status = 'active'),
    'monthly_subscriptions', (select count(*) from current_subscriptions where billing_interval = 'monthly'),
    'yearly_subscriptions', (select count(*) from current_subscriptions where billing_interval = 'yearly'),
    'lifetime_subscriptions', (select count(*) from current_subscriptions where status = 'lifetime'),
    'pending_payments', (select count(*) from public.payments where status = 'pending'),
    'failed_renewals', (select count(*) from public.payments where status = 'failed'),
    'canceled_subscriptions', (select count(*) from current_subscriptions where status = 'canceled'),
    'grace_period_accounts', (select count(*) from current_subscriptions where status = 'grace_period'),
    'read_only_accounts', (select count(*) from current_subscriptions where status = 'read_only'),
    'mrr_minor', (
      select coalesce(round(sum(case
        when billing_interval = 'monthly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(monthly_price_minor, 0)::numeric
        when billing_interval = 'yearly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(yearly_price_minor, 0)::numeric / 12
        else 0
      end)), 0)::bigint
        from current_subscriptions
    ),
    'arr_minor', (
      select coalesce(sum(case
        when billing_interval = 'monthly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(monthly_price_minor, 0) * 12
        when billing_interval = 'yearly' and status in ('active', 'past_due', 'grace_period', 'read_only')
          then coalesce(yearly_price_minor, 0)
        else 0
      end), 0)::bigint
        from current_subscriptions
    ),
    'successful_collected_minor', (
      select coalesce(sum(amount_minor), 0)::bigint
        from public.payments
       where status = 'succeeded'
    ),
    'refunded_total_minor', (
      select coalesce(sum(refunded_amount_minor), 0)::bigint
        from public.payments
    ),
    'new_organizations_30d', (
      select count(*)
        from public.organizations
       where created_at >= now() - interval '30 days'
    ),
    'active_users', (
      select count(*)
        from public.profiles
        join public.organizations on organizations.id = profiles.organization_id
       where profiles.is_active
         and organizations.status = 'active'
    ),
    'payment_error_count', (
      select count(*)
        from public.payment_events
       where processing_error is not null
    ),
    'last_successful_backup_at', null::timestamptz,
    'plan_distribution', coalesce((select jsonb_agg(to_jsonb(plan_distribution)) from plan_distribution), '[]'::jsonb)
  );
$$;

CREATE FUNCTION public.platform_finish_organization_deletion(target_organization_id uuid, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  deletion_job private.organization_deletion_jobs%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  perform 1 from public.organizations where id = target_organization_id for update;
  select * into deletion_job from private.organization_deletion_jobs where organization_id = target_organization_id for update;
  if not found or deletion_job.data_purged_at is null then
    raise exception 'organization_deletion_not_ready' using errcode = '23514';
  end if;
  if exists (select 1 from auth.users where id = any(deletion_job.user_ids)) then
    raise exception 'organization_auth_cleanup_required' using errcode = '23514';
  end if;
  if exists (select 1 from storage.objects where bucket_id in ('report-photos', 'organization-logos') and split_part(name, '/', 1) = target_organization_id::text) then
    raise exception 'organization_storage_cleanup_required' using errcode = '23514';
  end if;
  -- Clean records created by late billing callbacks before removing the tenant.
  perform public.platform_purge_organization_data(target_organization_id, actor_user_id);
  delete from public.audit_logs where organization_id = target_organization_id;
  delete from public.organizations where id = target_organization_id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id, after_data)
    values (null, actor_user_id, 'platform_organization_deleted', 'organizations', target_organization_id,
      jsonb_build_object('deleted_accounts', cardinality(deletion_job.user_ids)));
  return jsonb_build_object('organization_id', target_organization_id, 'deleted_accounts', cardinality(deletion_job.user_ids));
end;
$$;

CREATE FUNCTION public.platform_list_export_requests(target_organization_id uuid, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
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

CREATE FUNCTION public.platform_prepare_organization_deletion(target_organization_id uuid, confirmation_slug text, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  target_organization public.organizations%rowtype;
  deletion_job private.organization_deletion_jobs%rowtype;
  selected_users uuid[];
  selected_objects jsonb;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  select * into target_organization from public.organizations where id = target_organization_id for update;
  if not found then raise exception 'Organization was not found.' using errcode = 'P0002'; end if;
  if confirmation_slug is distinct from target_organization.slug then
    raise exception 'invalid_deletion_confirmation' using errcode = '22023';
  end if;
  select * into deletion_job from private.organization_deletion_jobs where organization_id = target_organization_id;
  if found then
    if exists (select 1 from private.platform_admins where user_id = any(deletion_job.user_ids)) then
      raise exception 'protected_organization_accounts' using errcode = '23514';
    end if;
    -- Include late uploads from requests that were already in flight at startup.
    update private.organization_deletion_jobs set storage_objects = (
      select coalesce(jsonb_agg(object), '[]'::jsonb) from (
        select value as object from jsonb_array_elements(deletion_job.storage_objects)
        union
        select jsonb_build_object('bucket', bucket_id, 'name', name) from storage.objects
        where bucket_id in ('report-photos', 'organization-logos')
          and split_part(name, '/', 1) = target_organization_id::text
      ) objects
    ) where organization_id = target_organization_id returning * into deletion_job;
    return to_jsonb(deletion_job);
  end if;

  perform 1 from public.profiles where organization_id = target_organization_id for update;
  perform 1 from public.organization_members where organization_id = target_organization_id for update;
  select coalesce(array_agg(id order by id), '{}'::uuid[]) into selected_users
    from public.profiles where organization_id = target_organization_id;
  if actor_user_id = any(selected_users)
     or exists (select 1 from private.platform_admins where user_id = any(selected_users))
     or exists (select 1 from public.organization_members where profile_id = any(selected_users) and organization_id <> target_organization_id)
     or exists (select 1 from public.organization_members where organization_id = target_organization_id and not (profile_id = any(selected_users)))
     or exists (select 1 from private.platform_export_requests where requested_by_user_id = any(selected_users) and organization_id <> target_organization_id) then
    raise exception 'protected_organization_accounts' using errcode = '23514';
  end if;
  if exists (select 1 from public.reports where organization_id <> target_organization_id and
       (created_by_user_id = any(selected_users) or updated_by_user_id = any(selected_users)
        or observer_personnel_id = any(selected_users) or customer_signed_by = any(selected_users)))
     or exists (select 1 from public.report_photos where organization_id <> target_organization_id and created_by = any(selected_users))
     or exists (select 1 from public.report_personnel where organization_id <> target_organization_id and profile_id = any(selected_users))
     or exists (select 1 from public.installation_assignments where organization_id <> target_organization_id and
       (assigned_to_profile_id = any(selected_users) or created_by_profile_id = any(selected_users))) then
    raise exception 'protected_organization_accounts' using errcode = '23514';
  end if;
  -- Never remove another tenant's object to make Auth account deletion succeed.
  if exists (select 1 from storage.objects where (owner = any(selected_users) or owner_id = any(selected_users::text[]))
    and (bucket_id not in ('report-photos', 'organization-logos') or split_part(name, '/', 1) <> target_organization_id::text))
    or exists (select 1 from public.report_photos where organization_id = target_organization_id and split_part(storage_path, '/', 1) <> target_organization_id::text)
    or (target_organization.logo_path is not null and split_part(target_organization.logo_path, '/', 1) <> target_organization_id::text)
    or exists (select 1 from private.platform_export_requests where organization_id = target_organization_id and artifact_path is not null) then
    raise exception 'out_of_scope_organization_files' using errcode = '23514';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('bucket', bucket_id, 'name', name)), '[]'::jsonb)
    into selected_objects from storage.objects where bucket_id in ('report-photos', 'organization-logos')
      and split_part(name, '/', 1) = target_organization_id::text;
  insert into private.organization_deletion_jobs (organization_id, user_ids, storage_objects)
    values (target_organization_id, selected_users, selected_objects) returning * into deletion_job;
  update public.organizations set status = 'closed', closed_at = coalesce(closed_at, now()), deletion_started_at = now()
    where id = target_organization_id;
  update public.profiles set is_active = false where organization_id = target_organization_id;
  update public.organization_members set is_active = false where organization_id = target_organization_id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id)
    values (target_organization_id, actor_user_id, 'platform_organization_deletion_started', 'organizations', target_organization_id);
  return to_jsonb(deletion_job);
end;
$$;

CREATE FUNCTION public.platform_purge_organization_data(target_organization_id uuid, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  deletion_job private.organization_deletion_jobs%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  perform 1 from public.organizations where id = target_organization_id for update;
  select * into deletion_job from private.organization_deletion_jobs where organization_id = target_organization_id for update;
  if not found then raise exception 'Organization deletion was not started.' using errcode = 'P0002'; end if;
  -- Parent deletion preserves the signed-report guards and uses existing FK cascades.
  delete from public.installation_assignments where organization_id = target_organization_id;
  delete from public.reports where organization_id = target_organization_id;
  delete from public.company_lines where organization_id = target_organization_id;
  delete from public.companies where organization_id = target_organization_id;
  delete from public.belts where organization_id = target_organization_id;
  delete from public.equipment where organization_id = target_organization_id;
  delete from public.vehicles where organization_id = target_organization_id;
  delete from public.report_number_counters where organization_id = target_organization_id;
  delete from public.invoices where organization_id = target_organization_id;
  delete from public.payment_events where organization_id = target_organization_id;
  delete from public.payments where organization_id = target_organization_id;
  delete from public.entitlements where organization_id = target_organization_id;
  delete from public.subscriptions where organization_id = target_organization_id;
  delete from private.platform_export_requests where organization_id = target_organization_id;
  delete from public.organization_members where organization_id = target_organization_id;
  delete from public.profiles where organization_id = target_organization_id;
  update private.organization_deletion_jobs set data_purged_at = now() where organization_id = target_organization_id;
  return jsonb_build_object('organization_id', target_organization_id, 'data_purged', true);
end;
$$;

CREATE FUNCTION public.platform_set_lifetime(target_organization_id uuid, enable_lifetime boolean, target_plan_id uuid, target_billing_interval public.billing_interval, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
declare
  target_organization public.organizations%rowtype;
  selected_subscription public.subscriptions%rowtype;
  before_status public.subscription_status;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;

  select *
    into target_organization
    from public.organizations
   where id = target_organization_id
   for update;

  if not found then
    raise exception 'Organization was not found.' using errcode = 'P0002';
  end if;

  if target_organization.status = 'closed' then
    raise exception 'A closed organization cannot be changed.' using errcode = '22023';
  end if;

  select *
    into selected_subscription
    from public.subscriptions
   where organization_id = target_organization_id
     and is_current
   for update;

  if enable_lifetime then
    if selected_subscription.id is null then
      insert into public.subscriptions (
        organization_id,
        status,
        billing_interval,
        starts_at
      ) values (
        target_organization_id,
        'lifetime'::public.subscription_status,
        'lifetime'::public.billing_interval,
        now()
      )
      returning * into selected_subscription;
    else
      before_status = selected_subscription.status;
      update public.subscriptions
         set plan_id = null,
             status = 'lifetime'::public.subscription_status,
             billing_interval = 'lifetime'::public.billing_interval,
             provider = null,
             provider_customer_id = null,
             provider_subscription_id = null,
             starts_at = coalesce(starts_at, now()),
             current_period_starts_at = null,
             current_period_ends_at = null,
             grace_period_ends_at = null,
             canceled_at = null
       where id = selected_subscription.id;
    end if;

    update public.organizations
       set status = 'active'::public.organization_status
     where id = target_organization_id;

    insert into public.audit_logs (
      organization_id, actor_id, action, entity_table, entity_id, before_data, after_data
    ) values (
      target_organization_id,
      actor_user_id,
      'platform_lifetime_granted',
      'subscriptions',
      selected_subscription.id,
      jsonb_build_object('status', coalesce(before_status::text, 'none')),
      jsonb_build_object('status', 'lifetime', 'transferable', false)
    );

    return jsonb_build_object('organization_id', target_organization_id, 'status', 'lifetime');
  end if;

  if target_plan_id is null or target_billing_interval not in ('monthly', 'yearly') then
    raise exception 'A monthly or yearly plan is required when lifetime access is removed.' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.plans where id = target_plan_id and is_active
  ) then
    raise exception 'The selected plan is not available.' using errcode = '22023';
  end if;

  if selected_subscription.id is null then
    insert into public.subscriptions (
      organization_id, plan_id, status, billing_interval
    ) values (
      target_organization_id,
      target_plan_id,
      'pending'::public.subscription_status,
      target_billing_interval
    )
    returning * into selected_subscription;
  else
    before_status = selected_subscription.status;
    update public.subscriptions
       set plan_id = target_plan_id,
           status = 'pending'::public.subscription_status,
           billing_interval = target_billing_interval,
           provider = null,
           provider_customer_id = null,
           provider_subscription_id = null,
           starts_at = null,
           current_period_starts_at = null,
           current_period_ends_at = null,
           grace_period_ends_at = null,
           canceled_at = null
     where id = selected_subscription.id;
  end if;

  update public.organizations
     set status = 'suspended'::public.organization_status
   where id = target_organization_id;

  insert into public.audit_logs (
    organization_id, actor_id, action, entity_table, entity_id, before_data, after_data
  ) values (
    target_organization_id,
    actor_user_id,
    'platform_lifetime_removed',
    'subscriptions',
    selected_subscription.id,
    jsonb_build_object('status', coalesce(before_status::text, 'lifetime')),
    jsonb_build_object('status', 'pending', 'billing_interval', target_billing_interval, 'plan_id', target_plan_id)
  );

  return jsonb_build_object('organization_id', target_organization_id, 'status', 'pending');
end;
$$;

CREATE FUNCTION public.platform_set_organization_status(target_organization_id uuid, target_status public.organization_status, actor_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO ''
    AS $$
declare
  target_organization public.organizations%rowtype;
begin
  if not private.is_platform_admin(actor_user_id) then
    raise exception 'Platform administrator permission is required.' using errcode = '42501';
  end if;
  select * into target_organization from public.organizations where id = target_organization_id for update;
  if not found then raise exception 'Organization was not found.' using errcode = 'P0002'; end if;
  if target_organization.deletion_started_at is not null then
    raise exception 'organization_deletion_pending' using errcode = '23514';
  end if;
  update public.organizations set status = target_status,
    closed_at = case when target_status = 'closed' then coalesce(closed_at, now()) else null end
  where id = target_organization_id;
  insert into public.audit_logs (organization_id, actor_id, action, entity_table, entity_id, before_data, after_data)
  values (target_organization_id, actor_user_id,
    case when target_status = 'active' and target_organization.status = 'closed' then 'platform_organization_reopened'
      when target_status = 'active' then 'platform_organization_activated'
      when target_status = 'suspended' then 'platform_organization_suspended'
      else 'platform_organization_closure_started' end,
    'organizations', target_organization_id,
    jsonb_build_object('status', target_organization.status), jsonb_build_object('status', target_status));
  return jsonb_build_object('organization_id', target_organization_id, 'status', target_status);
end;
$$;

CREATE FUNCTION public.prepare_installation_assignment() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
declare
  selected_company record;
  creator_organization_id uuid;
  assignee_organization_id uuid;
  linked_report_organization_id uuid;
begin
  if tg_op = 'INSERT' and new.created_by_profile_id is null then
    new.created_by_profile_id = auth.uid();
  end if;

  if tg_op = 'UPDATE' and new.organization_id is distinct from old.organization_id then
    raise exception 'Montaj atamasının organizasyonu değiştirilemez.';
  end if;

  if new.created_by_profile_id is not null then
    select organization_id
      into creator_organization_id
      from public.profiles
     where id = new.created_by_profile_id;
  end if;

  new.organization_id = coalesce(
    new.organization_id,
    creator_organization_id,
    private.current_organization_id()
  );

  if new.organization_id is null then
    raise exception 'Montaj ataması organizasyonu belirlenemedi.';
  end if;

  if creator_organization_id is not null
    and creator_organization_id is distinct from new.organization_id then
    raise exception 'Atamayı oluşturan kullanıcı başka firmaya ait.';
  end if;

  if new.assigned_to_profile_id is not null then
    select organization_id
      into assignee_organization_id
      from public.profiles
     where id = new.assigned_to_profile_id;

    if assignee_organization_id is distinct from new.organization_id then
      raise exception 'Başka firmaya ait personele montaj atanamaz.';
    end if;
  end if;

  if new.company_id is not null then
    select id, name
      into selected_company
      from public.companies
     where id = new.company_id
       and organization_id = new.organization_id;

    if selected_company.id is null then
      raise exception 'Firma bu organizasyona ait değil.';
    end if;

    new.company_name_snapshot = selected_company.name;
  end if;

  if new.report_id is not null then
    select organization_id
      into linked_report_organization_id
      from public.reports
     where id = new.report_id;

    if linked_report_organization_id is distinct from new.organization_id then
      raise exception 'Başka firmaya ait rapor montaj atamasına bağlanamaz.';
    end if;
  end if;

  if coalesce(trim(new.title), '') = '' then
    new.title = coalesce(
      nullif(trim(concat_ws(' - ', new.company_name_snapshot, new.line_name)), ''),
      'Montaj Ataması'
    );
  end if;

  if tg_op = 'UPDATE' then
    if old.status <> 'IN_PROGRESS' and new.status = 'IN_PROGRESS' then
      new.started_at = coalesce(new.started_at, now());
    end if;

    if old.status <> 'COMPLETED' and new.status = 'COMPLETED' then
      new.completed_at = coalesce(new.completed_at, now());
    end if;

    if old.status <> 'CANCELLED' and new.status = 'CANCELLED' then
      new.cancelled_at = coalesce(new.cancelled_at, now());
    end if;
  else
    if new.status = 'IN_PROGRESS' then
      new.started_at = coalesce(new.started_at, now());
    end if;

    if new.status = 'COMPLETED' then
      new.completed_at = coalesce(new.completed_at, now());
    end if;

    if new.status = 'CANCELLED' then
      new.cancelled_at = coalesce(new.cancelled_at, now());
    end if;
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.prepare_report() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'private'
    AS $$
declare
  creator record;
  selected_company record;
  selected_belt record;
  selected_observer record;
  seq integer;
  target_report_year integer;
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
  else
    new.updated_by_user_id = auth.uid();

    if new.organization_id is distinct from old.organization_id then
      raise exception 'Rapor organizasyonu değiştirilemez.';
    end if;
  end if;

  if new.created_by_user_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Aktif kullanıcı profili bulunamadı.';
    end if;

    new.organization_id = old.organization_id;
    new.created_by_name_snapshot = coalesce(
      nullif(new.created_by_name_snapshot, ''),
      old.created_by_name_snapshot,
      'Silinmiş personel'
    );
  else
    select id, first_name, last_name, organization_id
      into creator
      from public.profiles
     where id = new.created_by_user_id;

    if creator.id is null then
      raise exception 'Aktif kullanıcı profili bulunamadı.';
    end if;

    new.organization_id = coalesce(new.organization_id, creator.organization_id);

    if creator.organization_id is distinct from new.organization_id then
      raise exception 'Başka firmaya ait personel rapor oluşturamaz.';
    end if;

    new.created_by_name_snapshot = trim(creator.first_name || ' ' || creator.last_name);
  end if;

  if new.organization_id is null then
    raise exception 'Rapor organizasyonu belirlenemedi.';
  end if;

  if new.company_id is not null then
    select id, name, address, contact_name, contact_phone
      into selected_company
      from public.companies
     where id = new.company_id
       and organization_id = new.organization_id;

    if selected_company.id is null then
      raise exception 'Firma bu organizasyona ait değil.';
    end if;

    new.company_name_snapshot = selected_company.name;
    new.company_address_snapshot = selected_company.address;
    new.company_contact_name = coalesce(nullif(new.company_contact_name, ''), selected_company.contact_name);
    new.company_contact_phone = coalesce(nullif(new.company_contact_phone, ''), selected_company.contact_phone);
  end if;

  if new.belt_id is not null then
    select id, name, code
      into selected_belt
      from public.belts
     where id = new.belt_id
       and organization_id = new.organization_id;

    if selected_belt.id is null then
      raise exception 'Bant bu organizasyona ait değil.';
    end if;

    new.belt_name_snapshot = selected_belt.name;
    new.belt_code_snapshot = selected_belt.code;
  end if;

  if new.observer_personnel_id is not null then
    select id, first_name, last_name
      into selected_observer
      from public.profiles
     where id = new.observer_personnel_id
       and organization_id = new.organization_id;

    if selected_observer.id is null then
      raise exception 'Gözlemci bu organizasyona ait değil.';
    end if;

    new.observer_name_snapshot = trim(selected_observer.first_name || ' ' || selected_observer.last_name);
  end if;

  if new.status = 'SUBMITTED' and new.report_number is null then
    target_report_year = extract(year from new.report_date)::integer;

    insert into public.report_number_counters (organization_id, year, next_value)
    values (new.organization_id, target_report_year, 2)
    on conflict (organization_id, year)
    do update
      set next_value = public.report_number_counters.next_value + 1,
          updated_at = now()
    returning next_value - 1 into seq;

    new.report_year = target_report_year;
    new.sequence_number = seq;
    new.report_number = 'RPR-' || target_report_year::text || '-' || lpad(seq::text, 6, '0');
    new.submitted_at = coalesce(new.submitted_at, now());
  end if;

  return new;
end;
$$;

CREATE FUNCTION public.process_verified_payment_event(p_provider text, p_external_event_id text, p_event_type text, p_provider_customer_id text, p_provider_subscription_id text, p_external_payment_id text, p_amount_minor bigint, p_currency text, p_occurred_at timestamp with time zone, p_period_start_at timestamp with time zone, p_period_end_at timestamp with time zone, p_payload_hash text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
declare
  selected_subscription public.subscriptions%rowtype;
  selected_plan public.plans%rowtype;
  existing_event public.payment_events%rowtype;
  existing_payment public.payments%rowtype;
  event_id uuid;
  linked_payment_id uuid;
  normalized_currency text;
  expected_amount bigint;
  next_period_start timestamptz;
  next_period_end timestamptz;
  next_refunded_amount bigint;
begin
  if p_provider not in ('iyzico', 'paytr') then
    raise exception 'Unsupported payment provider.' using errcode = '22023';
  end if;

  if p_external_event_id is null or length(btrim(p_external_event_id)) not between 1 and 180 then
    raise exception 'Invalid external event id.' using errcode = '22023';
  end if;

  if p_event_type not in (
    'payment.succeeded',
    'payment.failed',
    'payment.refunded',
    'subscription.canceled'
  ) then
    raise exception 'Unsupported payment event type.' using errcode = '22023';
  end if;

  if p_provider_subscription_id is null
    or length(btrim(p_provider_subscription_id)) not between 1 and 180 then
    raise exception 'Payment subscription reference is required.' using errcode = '22023';
  end if;

  if p_occurred_at is null then
    raise exception 'Payment event time is required.' using errcode = '22023';
  end if;

  if p_payload_hash is null or p_payload_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'Invalid payment payload hash.' using errcode = '22023';
  end if;

  select *
    into selected_subscription
    from public.subscriptions
   where provider = p_provider
     and provider_subscription_id = btrim(p_provider_subscription_id)
     and is_current
   for update;

  if not found then
    raise exception 'Payment subscription reference was not found.' using errcode = 'P0002';
  end if;

  if p_event_type in ('payment.succeeded', 'payment.failed', 'payment.refunded') then
    if p_external_payment_id is null or length(btrim(p_external_payment_id)) not between 1 and 180 then
      raise exception 'Payment reference is required.' using errcode = '22023';
    end if;

    if p_amount_minor is null or p_amount_minor < 0 then
      raise exception 'Payment amount is invalid.' using errcode = '22023';
    end if;

    if p_currency is null or upper(btrim(p_currency)) !~ '^[A-Z]{3}$' then
      raise exception 'Payment currency is invalid.' using errcode = '22023';
    end if;

    normalized_currency = upper(btrim(p_currency));
  end if;

  if p_event_type = 'payment.succeeded' then
    if selected_subscription.plan_id is null then
      raise exception 'A plan is required before a payment can activate a subscription.' using errcode = '22023';
    end if;

    select *
      into selected_plan
      from public.plans
     where id = selected_subscription.plan_id;

    if not found or not selected_plan.is_active then
      raise exception 'The subscription plan is not available.' using errcode = '22023';
    end if;

    expected_amount = case selected_subscription.billing_interval
      when 'monthly' then selected_plan.monthly_price_minor
      when 'yearly' then selected_plan.yearly_price_minor
      else null
    end;

    if expected_amount is null
      or expected_amount <> p_amount_minor
      or selected_plan.currency <> normalized_currency then
      raise exception 'Payment amount or currency does not match the subscription plan.' using errcode = '22023';
    end if;
  end if;

  insert into public.payment_events (
    organization_id,
    provider,
    external_event_id,
    event_type,
    signature_verified,
    payload_hash,
    processed_at
  ) values (
    selected_subscription.organization_id,
    p_provider,
    btrim(p_external_event_id),
    p_event_type,
    true,
    p_payload_hash,
    clock_timestamp()
  )
  on conflict (provider, external_event_id) do nothing
  returning id into event_id;

  if event_id is null then
    select *
      into existing_event
      from public.payment_events
     where provider = p_provider
       and external_event_id = btrim(p_external_event_id)
     for update;

    if existing_event.payload_hash <> p_payload_hash then
      raise exception 'Payment webhook replay payload does not match.' using errcode = '23514';
    end if;

    return jsonb_build_object(
      'applied', false,
      'duplicate', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', existing_event.payment_id
    );
  end if;

  if p_event_type in ('payment.succeeded', 'payment.failed') then
    select *
      into existing_payment
      from public.payments
     where provider = p_provider
       and external_payment_id = btrim(p_external_payment_id)
     for update;

    if found then
      if existing_payment.organization_id <> selected_subscription.organization_id
        or (
          existing_payment.subscription_id is not null
          and existing_payment.subscription_id <> selected_subscription.id
        ) then
        raise exception 'Payment reference belongs to another subscription.' using errcode = '23514';
      end if;

      linked_payment_id = existing_payment.id;
    end if;
  end if;

  if p_event_type = 'payment.succeeded' then
    if existing_payment.id is not null and existing_payment.status = 'succeeded' then
      update public.payment_events
         set payment_id = existing_payment.id
       where id = event_id;

      return jsonb_build_object(
        'applied', false,
        'duplicate_payment', true,
        'organization_id', selected_subscription.organization_id,
        'payment_id', existing_payment.id
      );
    end if;

    if existing_payment.id is null then
      insert into public.payments (
        organization_id,
        subscription_id,
        provider,
        external_payment_id,
        status,
        amount_minor,
        currency,
        paid_at
      ) values (
        selected_subscription.organization_id,
        selected_subscription.id,
        p_provider,
        btrim(p_external_payment_id),
        'succeeded'::public.payment_status,
        p_amount_minor,
        normalized_currency,
        p_occurred_at
      )
      returning id into linked_payment_id;
    else
      update public.payments
         set subscription_id = selected_subscription.id,
             status = 'succeeded'::public.payment_status,
             amount_minor = p_amount_minor,
             currency = normalized_currency,
             paid_at = p_occurred_at
       where id = existing_payment.id;
    end if;

    if selected_subscription.billing_interval = 'lifetime' then
      update public.subscriptions
         set status = 'lifetime'::public.subscription_status,
             current_period_starts_at = null,
             current_period_ends_at = null,
             grace_period_ends_at = null,
             canceled_at = null
       where id = selected_subscription.id;
    else
      next_period_start = coalesce(
        p_period_start_at,
        selected_subscription.current_period_starts_at,
        p_occurred_at
      );
      next_period_end = p_period_end_at;

      if next_period_end is null then
        next_period_end = case selected_subscription.billing_interval
          when 'monthly' then next_period_start + interval '1 month'
          when 'yearly' then next_period_start + interval '1 year'
          else null
        end;
      end if;

      if next_period_end is null or next_period_end <= next_period_start then
        raise exception 'Payment period is invalid.' using errcode = '22023';
      end if;

      if selected_subscription.current_period_ends_at is not null
        and next_period_end <= selected_subscription.current_period_ends_at then
        next_period_start = coalesce(
          selected_subscription.current_period_starts_at,
          next_period_start
        );
        next_period_end = selected_subscription.current_period_ends_at;
      end if;

      update public.subscriptions
         set status = 'active'::public.subscription_status,
             starts_at = coalesce(starts_at, p_occurred_at),
             current_period_starts_at = next_period_start,
             current_period_ends_at = next_period_end,
             grace_period_ends_at = null,
             canceled_at = null
       where id = selected_subscription.id;
    end if;

    update public.organizations
       set status = 'active'::public.organization_status
     where id = selected_subscription.organization_id
       and status <> 'closed'::public.organization_status;

    update public.payment_events
       set payment_id = linked_payment_id
     where id = event_id;

    return jsonb_build_object(
      'applied', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', linked_payment_id,
      'subscription_status', case
        when selected_subscription.billing_interval = 'lifetime' then 'lifetime'
        else 'active'
      end
    );
  end if;

  if p_event_type = 'payment.failed' then
    if existing_payment.id is not null and existing_payment.status = 'succeeded' then
      update public.payment_events
         set payment_id = existing_payment.id
       where id = event_id;

      return jsonb_build_object(
        'applied', false,
        'payment_already_succeeded', true,
        'organization_id', selected_subscription.organization_id,
        'payment_id', existing_payment.id
      );
    end if;

    if existing_payment.id is null then
      insert into public.payments (
        organization_id,
        subscription_id,
        provider,
        external_payment_id,
        status,
        amount_minor,
        currency
      ) values (
        selected_subscription.organization_id,
        selected_subscription.id,
        p_provider,
        btrim(p_external_payment_id),
        'failed'::public.payment_status,
        p_amount_minor,
        normalized_currency
      )
      returning id into linked_payment_id;
    else
      update public.payments
         set subscription_id = selected_subscription.id,
             status = 'failed'::public.payment_status,
             amount_minor = p_amount_minor,
             currency = normalized_currency,
             paid_at = null
       where id = existing_payment.id;
    end if;

    if selected_subscription.status <> 'lifetime'::public.subscription_status
      and selected_subscription.status <> 'canceled'::public.subscription_status then
      update public.subscriptions
         set status = 'past_due'::public.subscription_status,
             grace_period_ends_at = coalesce(
               grace_period_ends_at,
               p_occurred_at + interval '7 days'
             )
       where id = selected_subscription.id;
    end if;

    update public.payment_events
       set payment_id = linked_payment_id
     where id = event_id;

    return jsonb_build_object(
      'applied', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', linked_payment_id,
      'subscription_status', 'past_due'
    );
  end if;

  if p_event_type = 'payment.refunded' then
    select *
      into existing_payment
      from public.payments
     where provider = p_provider
       and external_payment_id = btrim(p_external_payment_id)
     for update;

    if not found then
      raise exception 'Refund payment reference was not found.' using errcode = 'P0002';
    end if;

    if existing_payment.organization_id <> selected_subscription.organization_id
      or existing_payment.subscription_id is distinct from selected_subscription.id then
      raise exception 'Refund payment belongs to another subscription.' using errcode = '23514';
    end if;

    if existing_payment.currency <> normalized_currency
      or p_amount_minor <= 0
      or existing_payment.refunded_amount_minor + p_amount_minor > existing_payment.amount_minor then
      raise exception 'Refund amount or currency is invalid.' using errcode = '22023';
    end if;

    next_refunded_amount = existing_payment.refunded_amount_minor + p_amount_minor;
    update public.payments
       set refunded_amount_minor = next_refunded_amount,
           status = case
             when next_refunded_amount = amount_minor then 'refunded'::public.payment_status
             else status
           end
     where id = existing_payment.id;

    if next_refunded_amount = existing_payment.amount_minor
      and selected_subscription.status <> 'lifetime'::public.subscription_status
      and selected_subscription.status <> 'canceled'::public.subscription_status then
      update public.subscriptions
         set status = 'past_due'::public.subscription_status,
             grace_period_ends_at = coalesce(
               grace_period_ends_at,
               p_occurred_at + interval '7 days'
             )
       where id = selected_subscription.id;
    end if;

    update public.payment_events
       set payment_id = existing_payment.id
     where id = event_id;

    return jsonb_build_object(
      'applied', true,
      'organization_id', selected_subscription.organization_id,
      'payment_id', existing_payment.id,
      'refunded_amount_minor', next_refunded_amount
    );
  end if;

  update public.subscriptions
     set status = 'canceled'::public.subscription_status,
         canceled_at = coalesce(canceled_at, p_occurred_at)
   where id = selected_subscription.id;

  update public.organizations
     set status = 'suspended'::public.organization_status
   where id = selected_subscription.organization_id
     and status <> 'closed'::public.organization_status;

  return jsonb_build_object(
    'applied', true,
    'organization_id', selected_subscription.organization_id,
    'subscription_status', 'canceled'
  );
end;
$_$;

CREATE FUNCTION public.reconcile_organization_subscription(target_organization_id uuid, evaluated_at timestamp with time zone DEFAULT now()) RETURNS public.subscription_status
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  selected_subscription public.subscriptions%rowtype;
  next_status public.subscription_status;
  next_grace_period_ends_at timestamptz;
begin
  select *
    into selected_subscription
    from public.subscriptions
   where organization_id = target_organization_id
     and is_current
   for update;

  if selected_subscription.id is null then
    return null;
  end if;

  next_status = selected_subscription.status;
  next_grace_period_ends_at = selected_subscription.grace_period_ends_at;

  if selected_subscription.status = 'active'
    and selected_subscription.current_period_ends_at is not null
    and selected_subscription.current_period_ends_at <= evaluated_at then
    next_grace_period_ends_at = coalesce(
      selected_subscription.grace_period_ends_at,
      selected_subscription.current_period_ends_at + interval '7 days'
    );
    next_status = case
      when next_grace_period_ends_at > evaluated_at then 'grace_period'::public.subscription_status
      else 'read_only'::public.subscription_status
    end;
  elsif selected_subscription.status = 'past_due' then
    next_grace_period_ends_at = coalesce(
      selected_subscription.grace_period_ends_at,
      selected_subscription.updated_at + interval '7 days'
    );
    next_status = case
      when next_grace_period_ends_at > evaluated_at then 'grace_period'::public.subscription_status
      else 'read_only'::public.subscription_status
    end;
  elsif selected_subscription.status = 'grace_period'
    and coalesce(selected_subscription.grace_period_ends_at, evaluated_at) <= evaluated_at then
    next_status = 'read_only';
  end if;

  if next_status is distinct from selected_subscription.status
    or next_grace_period_ends_at is distinct from selected_subscription.grace_period_ends_at then
    update public.subscriptions
       set status = next_status,
           grace_period_ends_at = next_grace_period_ends_at
     where id = selected_subscription.id;
  end if;

  if next_status in ('active', 'past_due', 'grace_period', 'read_only', 'lifetime') then
    update public.organizations
       set status = 'active'
     where id = target_organization_id
       and status <> 'closed';
  end if;

  return next_status;
end;
$$;

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;

CREATE FUNCTION public.validate_customer_signature(signature_value jsonb) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
declare
  stroke_value jsonb;
  point_value jsonb;
  previous_point jsonb;
  point_count integer := 0;
  path_length numeric := 0;
begin
  if jsonb_typeof(signature_value) <> 'object' then
    return false;
  end if;

  if (
    select count(*) = 5
       and bool_and(key in ('version', 'signer_name', 'signer_title', 'consent', 'strokes'))
    from jsonb_object_keys(signature_value) as keys(key)
  ) is not true then
    return false;
  end if;

  if jsonb_typeof(signature_value->'version') <> 'number'
     or signature_value->'version' <> '1'::jsonb
     or jsonb_typeof(signature_value->'consent') <> 'boolean'
     or signature_value->'consent' <> 'true'::jsonb then
    return false;
  end if;

  if jsonb_typeof(signature_value->'signer_name') <> 'string'
     or jsonb_typeof(signature_value->'signer_title') <> 'string'
     or length(btrim(signature_value->>'signer_name')) not between 2 and 120
     or length(btrim(signature_value->>'signer_title')) not between 2 and 120 then
    return false;
  end if;

  if jsonb_typeof(signature_value->'strokes') <> 'array'
     or jsonb_array_length(signature_value->'strokes') not between 1 and 40 then
    return false;
  end if;

  for stroke_value in
    select element
    from jsonb_array_elements(signature_value->'strokes') as strokes(element)
  loop
    if jsonb_typeof(stroke_value) <> 'array'
       or jsonb_array_length(stroke_value) not between 2 and 500 then
      return false;
    end if;

    previous_point := null;

    for point_value in
      select element
      from jsonb_array_elements(stroke_value) as points(element)
    loop
      if jsonb_typeof(point_value) <> 'array'
         or jsonb_array_length(point_value) <> 2
         or jsonb_typeof(point_value->0) <> 'number'
         or jsonb_typeof(point_value->1) <> 'number'
         or (point_value->>0)::numeric < 0
         or (point_value->>0)::numeric > 600
         or (point_value->>1)::numeric < 0
         or (point_value->>1)::numeric > 240 then
        return false;
      end if;

      if previous_point is not null then
        path_length := path_length + sqrt(
          power((point_value->>0)::numeric - (previous_point->>0)::numeric, 2)
          + power((point_value->>1)::numeric - (previous_point->>1)::numeric, 2)
        );
      end if;

      previous_point := point_value;
      point_count := point_count + 1;
    end loop;
  end loop;

  return point_count <= 2000 and path_length >= 30;
exception
  when others then
    return false;
end;
$$;

COMMENT ON FUNCTION public.validate_customer_signature(signature_value jsonb) IS 'Strict validator matching packages/validation customerSignatureSchema for version 1 customer signature JSON.';

CREATE TABLE private.organization_deletion_jobs (
    organization_id uuid NOT NULL,
    user_ids uuid[] NOT NULL,
    storage_objects jsonb DEFAULT '[]'::jsonb NOT NULL,
    data_purged_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE private.platform_admins (
    user_id uuid NOT NULL,
    granted_by_user_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE private.platform_export_requests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    requested_by_user_id uuid NOT NULL,
    scope text DEFAULT 'organization'::text NOT NULL,
    status text DEFAULT 'queued'::text NOT NULL,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    completed_at timestamp with time zone,
    artifact_path text,
    error_code text,
    CONSTRAINT platform_export_requests_scope_check CHECK ((scope = 'organization'::text)),
    CONSTRAINT platform_export_requests_status_check CHECK ((status = ANY (ARRAY['queued'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'canceled'::text])))
);

CREATE TABLE public.audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    actor_id uuid,
    action text NOT NULL,
    entity_table text NOT NULL,
    entity_id uuid,
    before_data jsonb,
    after_data jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT private.current_organization_id()
);

CREATE TABLE public.belts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    code text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT private.current_organization_id() NOT NULL
);

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    address text,
    contact_name text,
    contact_phone text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT private.current_organization_id() NOT NULL
);

CREATE TABLE public.company_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);

CREATE TABLE public.entitlements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plan_id uuid,
    organization_id uuid,
    code text NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    value jsonb DEFAULT '{}'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT entitlements_check CHECK ((num_nonnulls(plan_id, organization_id) = 1)),
    CONSTRAINT entitlements_code_check CHECK ((code ~ '^[a-z0-9]+(?:\.[a-z0-9_]+)*$'::text))
);

CREATE TABLE public.equipment (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid DEFAULT private.current_organization_id() NOT NULL,
    name text NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT equipment_name_not_blank CHECK ((btrim(name) <> ''::text))
);

CREATE TABLE public.installation_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text DEFAULT ''::text NOT NULL,
    status public.installation_assignment_status DEFAULT 'ASSIGNED'::public.installation_assignment_status NOT NULL,
    assigned_to_profile_id uuid,
    created_by_profile_id uuid,
    report_id uuid,
    scheduled_date date,
    notes text,
    company_id uuid,
    company_name_snapshot text,
    line_name text,
    report_values jsonb DEFAULT '{}'::jsonb NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    cancelled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT private.current_organization_id() NOT NULL
);

CREATE TABLE public.invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid,
    payment_id uuid,
    provider text,
    external_invoice_id text,
    invoice_number text,
    status public.invoice_status DEFAULT 'draft'::public.invoice_status NOT NULL,
    currency text DEFAULT 'TRY'::text NOT NULL,
    subtotal_minor bigint DEFAULT 0 NOT NULL,
    tax_minor bigint DEFAULT 0 NOT NULL,
    total_minor bigint DEFAULT 0 NOT NULL,
    issued_at timestamp with time zone,
    due_at timestamp with time zone,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT invoices_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT invoices_subtotal_minor_check CHECK ((subtotal_minor >= 0)),
    CONSTRAINT invoices_tax_minor_check CHECK ((tax_minor >= 0)),
    CONSTRAINT invoices_total_minor_check CHECK ((total_minor >= 0))
);

CREATE TABLE public.organization_members (
    organization_id uuid NOT NULL,
    profile_id uuid NOT NULL,
    role public.organization_member_role DEFAULT 'PERSONNEL'::public.organization_member_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_profile_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.organizations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    status public.organization_status DEFAULT 'active'::public.organization_status NOT NULL,
    legal_name text,
    tax_identifier text,
    billing_email text,
    timezone text DEFAULT 'Europe/Istanbul'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    closed_at timestamp with time zone,
    logo_path text,
    deletion_started_at timestamp with time zone,
    CONSTRAINT organizations_deletion_is_closed CHECK (((deletion_started_at IS NULL) OR (status = 'closed'::public.organization_status))),
    CONSTRAINT organizations_name_check CHECK (((length(btrim(name)) >= 2) AND (length(btrim(name)) <= 160))),
    CONSTRAINT organizations_slug_check CHECK ((slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'::text))
);

COMMENT ON COLUMN public.organizations.logo_path IS 'Private storage path for the organization logo. Access is mediated by server APIs.';

CREATE TABLE public.payment_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid,
    payment_id uuid,
    provider text NOT NULL,
    external_event_id text NOT NULL,
    event_type text NOT NULL,
    signature_verified boolean DEFAULT false NOT NULL,
    payload_hash text NOT NULL,
    processed_at timestamp with time zone,
    processing_error text,
    received_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE public.payments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    subscription_id uuid,
    provider text NOT NULL,
    external_payment_id text,
    status public.payment_status DEFAULT 'pending'::public.payment_status NOT NULL,
    amount_minor bigint NOT NULL,
    refunded_amount_minor bigint DEFAULT 0 NOT NULL,
    currency text DEFAULT 'TRY'::text NOT NULL,
    paid_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT payments_amount_minor_check CHECK ((amount_minor >= 0)),
    CONSTRAINT payments_check CHECK (((refunded_amount_minor >= 0) AND (refunded_amount_minor <= amount_minor))),
    CONSTRAINT payments_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text))
);

CREATE TABLE public.plans (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    currency text DEFAULT 'TRY'::text NOT NULL,
    monthly_price_minor bigint,
    yearly_price_minor bigint,
    is_active boolean DEFAULT true NOT NULL,
    is_public boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT plans_code_check CHECK ((code ~ '^[a-z0-9]+(?:_[a-z0-9]+)*$'::text)),
    CONSTRAINT plans_currency_check CHECK ((currency ~ '^[A-Z]{3}$'::text)),
    CONSTRAINT plans_monthly_price_minor_check CHECK (((monthly_price_minor IS NULL) OR (monthly_price_minor >= 0))),
    CONSTRAINT plans_name_check CHECK (((length(btrim(name)) >= 2) AND (length(btrim(name)) <= 120))),
    CONSTRAINT plans_yearly_price_minor_check CHECK (((yearly_price_minor IS NULL) OR (yearly_price_minor >= 0)))
);

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    email text,
    phone text,
    role public.user_role DEFAULT 'PERSONNEL'::public.user_role NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);

CREATE TABLE public.report_number_counters (
    year integer NOT NULL,
    next_value integer DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);

CREATE TABLE public.report_personnel (
    report_id uuid NOT NULL,
    profile_id uuid,
    name_snapshot text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);

CREATE TABLE public.report_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    report_id uuid NOT NULL,
    storage_path text NOT NULL,
    category text NOT NULL,
    caption text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);

CREATE TABLE public.report_process_actions (
    report_id uuid NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);

CREATE TABLE public.report_process_types (
    report_id uuid NOT NULL,
    value text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid NOT NULL
);

CREATE TABLE public.reports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    client_request_id uuid NOT NULL,
    report_number text,
    report_year integer,
    sequence_number integer,
    status public.report_status DEFAULT 'DRAFT'::public.report_status NOT NULL,
    report_date date NOT NULL,
    created_by_user_id uuid,
    created_by_name_snapshot text NOT NULL,
    company_id uuid,
    company_name_snapshot text,
    company_address_snapshot text,
    company_contact_name text,
    company_contact_phone text,
    line_name text,
    machine_brand_model text,
    customer_machine_name text,
    belt_id uuid,
    belt_name_snapshot text,
    belt_code_snapshot text,
    vehicle_plate text,
    used_equipment text,
    workshop_departure_at timestamp with time zone,
    customer_arrival_at timestamp with time zone,
    customer_departure_at timestamp with time zone,
    factory_return_at timestamp with time zone,
    product_code text,
    product_measure text,
    product_width text,
    product_length text,
    product_quantity text,
    product_item_coil_code text,
    customer_stock_note text,
    product_types text[] DEFAULT '{}'::text[] NOT NULL,
    product_type_other text,
    process_actions text[] DEFAULT '{}'::text[] NOT NULL,
    edge_cut_method text,
    process_action_other text,
    mechanical_connection text,
    profile_material text,
    removed_belt_years text,
    replacement_reasons text[] DEFAULT '{}'::text[] NOT NULL,
    replacement_reason_other text,
    has_test_piece text,
    test_status text,
    observer_personnel_id uuid,
    observer_name_snapshot text,
    observer_external_name text,
    press_start_time time without time zone,
    press_end_time time without time zone,
    power_outage text,
    pressure_drop text,
    heat_balance_ok text,
    process_description text,
    billing_status text,
    technical_details text,
    tensioning_done text,
    customer_will_tension boolean DEFAULT false NOT NULL,
    customer_tensioned_auto boolean DEFAULT false NOT NULL,
    pressure_value text,
    pressure_unit text,
    pre_tension_percent text,
    line_delivered_running boolean DEFAULT false NOT NULL,
    blanket_roughening_info_given text,
    blanket_info_person_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    submitted_at timestamp with time zone,
    updated_by_user_id uuid,
    vehicle_start_km text,
    vehicle_end_km text,
    work_items jsonb DEFAULT '[]'::jsonb NOT NULL,
    organization_id uuid DEFAULT private.current_organization_id() NOT NULL,
    customer_signature jsonb,
    customer_signed_at timestamp with time zone,
    customer_signed_by uuid,
    customer_signature_required boolean DEFAULT false NOT NULL,
    CONSTRAINT reports_submitted_number_required CHECK (((status = 'DRAFT'::public.report_status) OR (report_number IS NOT NULL))),
    CONSTRAINT reports_work_items_array CHECK ((jsonb_typeof(work_items) = 'array'::text))
);

COMMENT ON COLUMN public.reports.customer_signature IS 'Versioned customer approval vector: {version, signer_name, signer_title, consent, strokes}; immutable with report contents after submission.';

COMMENT ON COLUMN public.reports.customer_signed_at IS 'Database timestamp assigned when a report first transitions to SUBMITTED with customer approval.';

COMMENT ON COLUMN public.reports.customer_signed_by IS 'Authenticated profile that submitted the customer approval; nullable only through profile deletion history preservation.';

COMMENT ON COLUMN public.reports.customer_signature_required IS 'Report-specific rollout marker set by clients that support customer approval; not a role, security, or tenant authorization claim.';

CREATE TABLE public.subscriptions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid,
    status public.subscription_status DEFAULT 'pending'::public.subscription_status NOT NULL,
    billing_interval public.billing_interval NOT NULL,
    provider text,
    provider_customer_id text,
    provider_subscription_id text,
    starts_at timestamp with time zone,
    current_period_starts_at timestamp with time zone,
    current_period_ends_at timestamp with time zone,
    grace_period_ends_at timestamp with time zone,
    canceled_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_current boolean DEFAULT true NOT NULL,
    CONSTRAINT subscriptions_check CHECK (((status <> 'lifetime'::public.subscription_status) OR (billing_interval = 'lifetime'::public.billing_interval))),
    CONSTRAINT subscriptions_check1 CHECK (((billing_interval <> 'lifetime'::public.billing_interval) OR (current_period_ends_at IS NULL)))
);

CREATE TABLE public.vehicles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    plate text NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    organization_id uuid DEFAULT private.current_organization_id() NOT NULL
);

ALTER TABLE ONLY private.organization_deletion_jobs
    ADD CONSTRAINT organization_deletion_jobs_pkey PRIMARY KEY (organization_id);

ALTER TABLE ONLY private.platform_admins
    ADD CONSTRAINT platform_admins_pkey PRIMARY KEY (user_id);

ALTER TABLE ONLY private.platform_export_requests
    ADD CONSTRAINT platform_export_requests_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.belts
    ADD CONSTRAINT belts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.company_lines
    ADD CONSTRAINT company_lines_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.installation_assignments
    ADD CONSTRAINT installation_assignments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_pkey PRIMARY KEY (organization_id, profile_id);

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_slug_key UNIQUE (slug);

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_provider_external_event_id_key UNIQUE (provider, external_event_id);

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_code_key UNIQUE (code);

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_email_key UNIQUE (email);

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.report_number_counters
    ADD CONSTRAINT report_number_counters_pkey PRIMARY KEY (organization_id, year);

ALTER TABLE ONLY public.report_personnel
    ADD CONSTRAINT report_personnel_pkey PRIMARY KEY (report_id, name_snapshot);

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_pkey PRIMARY KEY (id);

ALTER TABLE public.report_photos
    ADD CONSTRAINT report_photos_storage_path_format_check CHECK ((storage_path ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp)$'::text)) NOT VALID;

ALTER TABLE ONLY public.report_process_actions
    ADD CONSTRAINT report_process_actions_pkey PRIMARY KEY (report_id, value);

ALTER TABLE ONLY public.report_process_types
    ADD CONSTRAINT report_process_types_pkey PRIMARY KEY (report_id, value);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_client_request_id_key UNIQUE (client_request_id);

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_pkey PRIMARY KEY (id);

CREATE INDEX platform_admins_granted_by_idx ON private.platform_admins USING btree (granted_by_user_id) WHERE (granted_by_user_id IS NOT NULL);

CREATE INDEX platform_export_requests_organization_idx ON private.platform_export_requests USING btree (organization_id, requested_at DESC);

CREATE INDEX audit_logs_actor_idx ON public.audit_logs USING btree (actor_id) WHERE (actor_id IS NOT NULL);

CREATE INDEX audit_logs_organization_created_idx ON public.audit_logs USING btree (organization_id, created_at DESC);

CREATE INDEX belts_active_idx ON public.belts USING btree (is_active);

CREATE INDEX belts_organization_active_code_idx ON public.belts USING btree (organization_id, is_active, code);

CREATE UNIQUE INDEX belts_organization_code_unique_idx ON public.belts USING btree (organization_id, lower(code));

CREATE INDEX belts_organization_idx ON public.belts USING btree (organization_id);

CREATE INDEX companies_active_idx ON public.companies USING btree (is_active);

CREATE INDEX companies_organization_active_name_idx ON public.companies USING btree (organization_id, is_active, name);

CREATE INDEX companies_organization_idx ON public.companies USING btree (organization_id);

CREATE INDEX company_lines_company_id_idx ON public.company_lines USING btree (company_id);

CREATE UNIQUE INDEX company_lines_company_name_unique ON public.company_lines USING btree (company_id, lower(name));

CREATE INDEX company_lines_organization_company_name_idx ON public.company_lines USING btree (organization_id, company_id, name);

CREATE INDEX company_lines_organization_idx ON public.company_lines USING btree (organization_id);

CREATE UNIQUE INDEX entitlements_organization_code_unique_idx ON public.entitlements USING btree (organization_id, code) WHERE (organization_id IS NOT NULL);

CREATE UNIQUE INDEX entitlements_plan_code_unique_idx ON public.entitlements USING btree (plan_id, code) WHERE (plan_id IS NOT NULL);

CREATE INDEX equipment_organization_active_name_idx ON public.equipment USING btree (organization_id, is_active, lower(name));

CREATE UNIQUE INDEX equipment_organization_name_unique_idx ON public.equipment USING btree (organization_id, lower(name));

CREATE INDEX installation_assignments_assigned_status_idx ON public.installation_assignments USING btree (assigned_to_profile_id, status, scheduled_date);

CREATE INDEX installation_assignments_company_idx ON public.installation_assignments USING btree (company_id);

CREATE INDEX installation_assignments_created_by_idx ON public.installation_assignments USING btree (created_by_profile_id) WHERE (created_by_profile_id IS NOT NULL);

CREATE INDEX installation_assignments_organization_idx ON public.installation_assignments USING btree (organization_id, created_at DESC);

CREATE INDEX installation_assignments_organization_status_date_idx ON public.installation_assignments USING btree (organization_id, status, scheduled_date);

CREATE INDEX installation_assignments_report_idx ON public.installation_assignments USING btree (report_id);

CREATE INDEX invoices_organization_status_idx ON public.invoices USING btree (organization_id, status, created_at DESC);

CREATE INDEX invoices_payment_idx ON public.invoices USING btree (payment_id) WHERE (payment_id IS NOT NULL);

CREATE UNIQUE INDEX invoices_provider_reference_unique_idx ON public.invoices USING btree (provider, external_invoice_id) WHERE ((provider IS NOT NULL) AND (external_invoice_id IS NOT NULL));

CREATE INDEX invoices_subscription_idx ON public.invoices USING btree (subscription_id) WHERE (subscription_id IS NOT NULL);

CREATE INDEX organization_members_created_by_idx ON public.organization_members USING btree (created_by_profile_id) WHERE (created_by_profile_id IS NOT NULL);

CREATE INDEX organization_members_profile_idx ON public.organization_members USING btree (profile_id, is_active);

CREATE INDEX payment_events_organization_received_idx ON public.payment_events USING btree (organization_id, received_at DESC);

CREATE INDEX payment_events_payment_idx ON public.payment_events USING btree (payment_id) WHERE (payment_id IS NOT NULL);

CREATE INDEX payments_organization_status_idx ON public.payments USING btree (organization_id, status, created_at DESC);

CREATE UNIQUE INDEX payments_provider_external_payment_unique_idx ON public.payments USING btree (provider, external_payment_id) WHERE (external_payment_id IS NOT NULL);

CREATE UNIQUE INDEX payments_provider_reference_unique_idx ON public.payments USING btree (provider, external_payment_id) WHERE (external_payment_id IS NOT NULL);

CREATE INDEX payments_subscription_idx ON public.payments USING btree (subscription_id) WHERE (subscription_id IS NOT NULL);

CREATE INDEX profiles_active_idx ON public.profiles USING btree (is_active);

CREATE INDEX profiles_organization_idx ON public.profiles USING btree (organization_id);

CREATE INDEX profiles_organization_role_active_name_idx ON public.profiles USING btree (organization_id, role, is_active, first_name);

CREATE INDEX report_personnel_organization_idx ON public.report_personnel USING btree (organization_id);

CREATE INDEX report_personnel_profile_idx ON public.report_personnel USING btree (profile_id) WHERE (profile_id IS NOT NULL);

CREATE INDEX report_photos_created_by_idx ON public.report_photos USING btree (created_by) WHERE (created_by IS NOT NULL);

CREATE INDEX report_photos_organization_idx ON public.report_photos USING btree (organization_id);

CREATE INDEX report_photos_report_idx ON public.report_photos USING btree (report_id);

CREATE INDEX report_process_actions_organization_idx ON public.report_process_actions USING btree (organization_id);

CREATE INDEX report_process_types_organization_idx ON public.report_process_types USING btree (organization_id);

CREATE INDEX reports_belt_idx ON public.reports USING btree (belt_id) WHERE (belt_id IS NOT NULL);

CREATE INDEX reports_company_id_idx ON public.reports USING btree (company_id);

CREATE INDEX reports_created_by_idx ON public.reports USING btree (created_by_user_id);

CREATE INDEX reports_observer_idx ON public.reports USING btree (observer_personnel_id) WHERE (observer_personnel_id IS NOT NULL);

CREATE INDEX reports_organization_created_idx ON public.reports USING btree (organization_id, created_at DESC);

CREATE UNIQUE INDEX reports_organization_number_unique_idx ON public.reports USING btree (organization_id, report_number) WHERE (report_number IS NOT NULL);

CREATE UNIQUE INDEX reports_organization_sequence_unique_idx ON public.reports USING btree (organization_id, report_year, sequence_number) WHERE ((report_year IS NOT NULL) AND (sequence_number IS NOT NULL));

CREATE INDEX reports_report_date_idx ON public.reports USING btree (report_date);

CREATE INDEX reports_report_number_idx ON public.reports USING btree (report_number);

CREATE INDEX reports_status_idx ON public.reports USING btree (status);

CREATE INDEX reports_submitted_at_idx ON public.reports USING btree (submitted_at);

CREATE INDEX reports_updated_by_idx ON public.reports USING btree (updated_by_user_id) WHERE (updated_by_user_id IS NOT NULL);

CREATE UNIQUE INDEX subscriptions_one_current_per_organization_idx ON public.subscriptions USING btree (organization_id) WHERE is_current;

CREATE INDEX subscriptions_organization_status_idx ON public.subscriptions USING btree (organization_id, status);

CREATE INDEX subscriptions_plan_idx ON public.subscriptions USING btree (plan_id);

CREATE UNIQUE INDEX subscriptions_provider_reference_unique_idx ON public.subscriptions USING btree (provider, provider_subscription_id) WHERE ((provider IS NOT NULL) AND (provider_subscription_id IS NOT NULL));

CREATE INDEX vehicles_organization_idx ON public.vehicles USING btree (organization_id);

CREATE INDEX vehicles_organization_plate_idx ON public.vehicles USING btree (organization_id, plate);

CREATE UNIQUE INDEX vehicles_organization_plate_unique_idx ON public.vehicles USING btree (organization_id, lower(plate));

CREATE TRIGGER platform_admins_deletion_identity_guard BEFORE INSERT OR UPDATE OF user_id ON private.platform_admins FOR EACH ROW EXECUTE FUNCTION private.guard_deletion_identity_changes();

CREATE TRIGGER belts_audit AFTER INSERT OR UPDATE ON public.belts FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

CREATE TRIGGER belts_set_updated_at BEFORE UPDATE ON public.belts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER companies_audit AFTER INSERT OR UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

CREATE TRIGGER companies_set_updated_at BEFORE UPDATE ON public.companies FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER company_lines_audit AFTER INSERT OR DELETE OR UPDATE ON public.company_lines FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

CREATE TRIGGER company_lines_set_organization BEFORE INSERT OR UPDATE ON public.company_lines FOR EACH ROW EXECUTE FUNCTION private.set_company_line_organization();

CREATE TRIGGER company_lines_set_updated_at BEFORE UPDATE ON public.company_lines FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER entitlements_set_updated_at BEFORE UPDATE ON public.entitlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER equipment_set_updated_at BEFORE UPDATE ON public.equipment FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER installation_assignments_audit AFTER INSERT OR DELETE OR UPDATE ON public.installation_assignments FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

CREATE TRIGGER installation_assignments_guard_update BEFORE UPDATE ON public.installation_assignments FOR EACH ROW EXECUTE FUNCTION public.guard_installation_assignment_personnel_update();

CREATE TRIGGER installation_assignments_prepare BEFORE INSERT OR UPDATE ON public.installation_assignments FOR EACH ROW EXECUTE FUNCTION public.prepare_installation_assignment();

CREATE TRIGGER installation_assignments_set_updated_at BEFORE UPDATE ON public.installation_assignments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER invoices_set_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER memberships_deletion_identity_guard BEFORE INSERT OR UPDATE OF profile_id, organization_id ON public.organization_members FOR EACH ROW EXECUTE FUNCTION private.guard_deletion_identity_changes();

CREATE TRIGGER organization_members_set_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER organizations_deletion_state_guard BEFORE UPDATE OF status, deletion_started_at ON public.organizations FOR EACH ROW EXECUTE FUNCTION private.guard_organization_deletion_state();

CREATE TRIGGER organizations_set_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON public.payments FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER plans_set_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER profiles_audit AFTER INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

CREATE TRIGGER profiles_deletion_identity_guard BEFORE INSERT OR UPDATE OF id, organization_id ON public.profiles FOR EACH ROW EXECUTE FUNCTION private.guard_deletion_identity_changes();

CREATE TRIGGER profiles_set_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER report_personnel_set_organization BEFORE INSERT OR UPDATE ON public.report_personnel FOR EACH ROW EXECUTE FUNCTION private.set_report_child_organization();

CREATE TRIGGER report_personnel_signed_report_guard BEFORE INSERT OR DELETE OR UPDATE ON public.report_personnel FOR EACH ROW EXECUTE FUNCTION public.guard_signed_report_child_rows();

CREATE TRIGGER report_photos_set_organization BEFORE INSERT OR UPDATE ON public.report_photos FOR EACH ROW EXECUTE FUNCTION private.prepare_report_photo();

CREATE TRIGGER report_photos_signed_report_guard BEFORE INSERT OR DELETE OR UPDATE ON public.report_photos FOR EACH ROW EXECUTE FUNCTION public.guard_signed_report_child_rows();

CREATE TRIGGER report_process_actions_set_organization BEFORE INSERT OR UPDATE ON public.report_process_actions FOR EACH ROW EXECUTE FUNCTION private.set_report_child_organization();

CREATE TRIGGER report_process_actions_signed_report_guard BEFORE INSERT OR DELETE OR UPDATE ON public.report_process_actions FOR EACH ROW EXECUTE FUNCTION public.guard_signed_report_child_rows();

CREATE TRIGGER report_process_types_set_organization BEFORE INSERT OR UPDATE ON public.report_process_types FOR EACH ROW EXECUTE FUNCTION private.set_report_child_organization();

CREATE TRIGGER report_process_types_signed_report_guard BEFORE INSERT OR DELETE OR UPDATE ON public.report_process_types FOR EACH ROW EXECUTE FUNCTION public.guard_signed_report_child_rows();

CREATE TRIGGER reports_audit AFTER UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

CREATE TRIGGER reports_prepare BEFORE INSERT OR UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.prepare_report();

CREATE TRIGGER reports_set_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER reports_zz_customer_signature_guard BEFORE INSERT OR UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.guard_customer_signature();

CREATE TRIGGER subscriptions_set_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER vehicles_audit AFTER INSERT OR DELETE OR UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.log_admin_change();

CREATE TRIGGER vehicles_set_updated_at BEFORE UPDATE ON public.vehicles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE ONLY private.organization_deletion_jobs
    ADD CONSTRAINT organization_deletion_jobs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE ONLY private.platform_admins
    ADD CONSTRAINT platform_admins_granted_by_user_id_fkey FOREIGN KEY (granted_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY private.platform_admins
    ADD CONSTRAINT platform_admins_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY private.platform_export_requests
    ADD CONSTRAINT platform_export_requests_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY private.platform_export_requests
    ADD CONSTRAINT platform_export_requests_requested_by_user_id_fkey FOREIGN KEY (requested_by_user_id) REFERENCES auth.users(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.belts
    ADD CONSTRAINT belts_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.company_lines
    ADD CONSTRAINT company_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.company_lines
    ADD CONSTRAINT company_lines_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.entitlements
    ADD CONSTRAINT entitlements_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.equipment
    ADD CONSTRAINT equipment_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.installation_assignments
    ADD CONSTRAINT installation_assignments_assigned_to_profile_id_fkey FOREIGN KEY (assigned_to_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.installation_assignments
    ADD CONSTRAINT installation_assignments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.installation_assignments
    ADD CONSTRAINT installation_assignments_created_by_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.installation_assignments
    ADD CONSTRAINT installation_assignments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.installation_assignments
    ADD CONSTRAINT installation_assignments_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.invoices
    ADD CONSTRAINT invoices_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_created_by_profile_id_fkey FOREIGN KEY (created_by_profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.organization_members
    ADD CONSTRAINT organization_members_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.payment_events
    ADD CONSTRAINT payment_events_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_subscription_id_fkey FOREIGN KEY (subscription_id) REFERENCES public.subscriptions(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.report_number_counters
    ADD CONSTRAINT report_number_counters_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.report_personnel
    ADD CONSTRAINT report_personnel_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.report_personnel
    ADD CONSTRAINT report_personnel_profile_id_fkey FOREIGN KEY (profile_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.report_personnel
    ADD CONSTRAINT report_personnel_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.report_photos
    ADD CONSTRAINT report_photos_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.report_process_actions
    ADD CONSTRAINT report_process_actions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.report_process_actions
    ADD CONSTRAINT report_process_actions_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.report_process_types
    ADD CONSTRAINT report_process_types_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.report_process_types
    ADD CONSTRAINT report_process_types_report_id_fkey FOREIGN KEY (report_id) REFERENCES public.reports(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_belt_id_fkey FOREIGN KEY (belt_id) REFERENCES public.belts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_customer_signed_by_fkey FOREIGN KEY (customer_signed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_observer_personnel_id_fkey FOREIGN KEY (observer_personnel_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_updated_by_user_id_fkey FOREIGN KEY (updated_by_user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_plan_id_fkey FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE RESTRICT;

ALTER TABLE ONLY public.vehicles
    ADD CONSTRAINT vehicles_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;

ALTER TABLE private.organization_deletion_jobs ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY audit_logs_insert_authenticated ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND (( SELECT auth.uid() AS uid) IS NOT NULL)));

CREATE POLICY audit_logs_select_admin ON public.audit_logs FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin()));

ALTER TABLE public.belts ENABLE ROW LEVEL SECURITY;

CREATE POLICY belts_insert_admin ON public.belts FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY belts_select ON public.belts FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (private.is_active_profile() AND is_active))));

CREATE POLICY belts_update_admin ON public.belts FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin())) WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY companies_insert_admin ON public.companies FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY companies_select ON public.companies FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (private.is_active_profile() AND is_active))));

CREATE POLICY companies_update_admin ON public.companies FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin())) WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

ALTER TABLE public.company_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY company_lines_delete_admin ON public.company_lines FOR DELETE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY company_lines_insert_admin ON public.company_lines FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY company_lines_select ON public.company_lines FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_active_profile()));

CREATE POLICY company_lines_update_admin ON public.company_lines FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin())) WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY entitlements_select ON public.entitlements FOR SELECT TO anon, authenticated USING ((((plan_id IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM public.plans
  WHERE ((plans.id = entitlements.plan_id) AND plans.is_active AND plans.is_public)))) OR ((organization_id IS NOT NULL) AND private.is_organization_member(organization_id))));

ALTER TABLE public.equipment ENABLE ROW LEVEL SECURITY;

CREATE POLICY equipment_delete_admin ON public.equipment FOR DELETE TO authenticated USING ((organization_id = private.current_organization_id()));

CREATE POLICY equipment_delete_owner_guard ON public.equipment AS RESTRICTIVE FOR DELETE TO authenticated USING (private.is_admin());

CREATE POLICY equipment_insert_admin ON public.equipment FOR INSERT TO authenticated WITH CHECK ((organization_id = private.current_organization_id()));

CREATE POLICY equipment_insert_owner_guard ON public.equipment AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.is_admin());

CREATE POLICY equipment_select ON public.equipment FOR SELECT TO authenticated USING ((organization_id = private.current_organization_id()));

CREATE POLICY equipment_update_admin ON public.equipment FOR UPDATE TO authenticated USING ((organization_id = private.current_organization_id())) WITH CHECK ((organization_id = private.current_organization_id()));

CREATE POLICY equipment_update_owner_guard ON public.equipment AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.is_admin()) WITH CHECK (private.is_admin());

ALTER TABLE public.installation_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY installation_assignments_delete_admin ON public.installation_assignments FOR DELETE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY installation_assignments_insert_admin ON public.installation_assignments FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY installation_assignments_select ON public.installation_assignments FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (private.is_active_profile() AND (assigned_to_profile_id = ( SELECT auth.uid() AS uid))))));

CREATE POLICY installation_assignments_update_admin_or_assignee ON public.installation_assignments FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (private.is_active_profile() AND (assigned_to_profile_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['ASSIGNED'::public.installation_assignment_status, 'IN_PROGRESS'::public.installation_assignment_status])))))) WITH CHECK (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (private.is_active_profile() AND (assigned_to_profile_id = ( SELECT auth.uid() AS uid)) AND (status = ANY (ARRAY['ASSIGNED'::public.installation_assignment_status, 'IN_PROGRESS'::public.installation_assignment_status, 'COMPLETED'::public.installation_assignment_status]))))));

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoices_select_organization_admin ON public.invoices FOR SELECT TO authenticated USING (private.has_organization_role(organization_id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role]));

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY organization_members_select_member ON public.organization_members FOR SELECT TO authenticated USING (private.is_organization_member(organization_id));

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY organizations_select_member ON public.organizations FOR SELECT TO authenticated USING (private.is_organization_member(id));

CREATE POLICY organizations_update_admin ON public.organizations FOR UPDATE TO authenticated USING (((id = private.current_organization_id()) AND private.has_organization_role(id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role]))) WITH CHECK (((id = private.current_organization_id()) AND private.has_organization_role(id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role])));

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY payments_select_organization_admin ON public.payments FOR SELECT TO authenticated USING (private.has_organization_role(organization_id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role]));

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_public_select ON public.plans FOR SELECT TO anon, authenticated USING ((is_active AND is_public));

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_insert_admin ON public.profiles FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY profiles_select ON public.profiles FOR SELECT TO authenticated USING (((id = ( SELECT auth.uid() AS uid)) OR ((organization_id = private.current_organization_id()) AND private.is_organization_member(organization_id) AND is_active) OR ((organization_id = private.current_organization_id()) AND private.is_admin())));

CREATE POLICY profiles_update_admin ON public.profiles FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin())) WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

ALTER TABLE public.report_number_counters ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.report_personnel ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_personnel_delete_owner_or_admin ON public.report_personnel FOR DELETE TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_personnel.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_personnel_insert_owner_or_admin ON public.report_personnel FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_personnel.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_personnel_select ON public.report_personnel FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_personnel.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

ALTER TABLE public.report_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_photos_delete_owner_or_admin ON public.report_photos FOR DELETE TO authenticated USING (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (created_by = ( SELECT auth.uid() AS uid)))));

CREATE POLICY report_photos_insert_owner_or_admin ON public.report_photos FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND (created_by = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_photos.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_photos_select ON public.report_photos FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_photos.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

ALTER TABLE public.report_process_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_process_actions_delete ON public.report_process_actions FOR DELETE TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_actions.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_process_actions_insert ON public.report_process_actions FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_actions.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_process_actions_select ON public.report_process_actions FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_actions.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_process_actions_update ON public.report_process_actions FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_actions.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_actions.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

ALTER TABLE public.report_process_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY report_process_types_delete ON public.report_process_types FOR DELETE TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_types.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_process_types_insert ON public.report_process_types FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_types.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_process_types_select ON public.report_process_types FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_types.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_process_types_update ON public.report_process_types FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_types.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK (((organization_id = private.current_organization_id()) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE ((reports.id = report_process_types.report_id) AND (reports.organization_id = private.current_organization_id()) AND (private.is_admin() OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY reports_insert_active ON public.reports FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_active_profile()));

CREATE POLICY reports_select ON public.reports FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (created_by_user_id = ( SELECT auth.uid() AS uid)))));

CREATE POLICY reports_update_owner_draft_or_admin ON public.reports FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (private.is_active_organization_member(organization_id) AND (created_by_user_id = ( SELECT auth.uid() AS uid)) AND ((status = 'DRAFT'::public.report_status) OR ((status = 'SUBMITTED'::public.report_status) AND (customer_signature IS NOT NULL))))))) WITH CHECK (((organization_id = private.current_organization_id()) AND (private.is_admin() OR (private.is_active_organization_member(organization_id) AND (created_by_user_id = ( SELECT auth.uid() AS uid)) AND ((status = 'DRAFT'::public.report_status) OR ((status = 'SUBMITTED'::public.report_status) AND (customer_signature IS NOT NULL)))))));

CREATE POLICY subscription_delete_access ON public.belts AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.companies AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.company_lines AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.equipment AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.installation_assignments AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.report_personnel AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.report_photos AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.report_process_actions AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.report_process_types AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.reports AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_delete_access ON public.vehicles AS RESTRICTIVE FOR DELETE TO authenticated USING (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.belts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.companies AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.company_lines AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.equipment AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.installation_assignments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.report_personnel AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.report_photos AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.report_process_actions AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.report_process_types AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.reports AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_insert_access ON public.vehicles AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_read_access ON public.audit_logs AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.belts AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.companies AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.company_lines AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.equipment AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.installation_assignments AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.report_personnel AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.report_photos AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.report_process_actions AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.report_process_types AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.reports AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_read_access ON public.vehicles AS RESTRICTIVE FOR SELECT TO authenticated USING (private.has_application_read_access(organization_id));

CREATE POLICY subscription_update_access ON public.belts AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.companies AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.company_lines AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.equipment AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.installation_assignments AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.report_personnel AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.report_photos AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.report_process_actions AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.report_process_types AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.reports AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_update_access ON public.vehicles AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

CREATE POLICY subscription_write_access ON public.profiles AS RESTRICTIVE FOR UPDATE TO authenticated USING (private.has_application_write_access(organization_id)) WITH CHECK (private.has_application_write_access(organization_id));

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select_organization_admin ON public.subscriptions FOR SELECT TO authenticated USING (private.has_organization_role(organization_id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role]));

ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY;

CREATE POLICY vehicles_delete_admin ON public.vehicles FOR DELETE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY vehicles_insert_admin ON public.vehicles FOR INSERT TO authenticated WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

CREATE POLICY vehicles_select ON public.vehicles FOR SELECT TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_active_profile()));

CREATE POLICY vehicles_update_admin ON public.vehicles FOR UPDATE TO authenticated USING (((organization_id = private.current_organization_id()) AND private.is_admin())) WITH CHECK (((organization_id = private.current_organization_id()) AND private.is_admin()));

GRANT USAGE ON SCHEMA private TO authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

REVOKE USAGE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;

GRANT ALL ON TYPE public.billing_interval TO authenticated;
GRANT ALL ON TYPE public.billing_interval TO service_role;

GRANT ALL ON TYPE public.invoice_status TO authenticated;
GRANT ALL ON TYPE public.invoice_status TO service_role;

GRANT ALL ON TYPE public.organization_member_role TO authenticated;
GRANT ALL ON TYPE public.organization_member_role TO service_role;

GRANT ALL ON TYPE public.organization_status TO authenticated;
GRANT ALL ON TYPE public.organization_status TO service_role;

GRANT ALL ON TYPE public.payment_status TO authenticated;
GRANT ALL ON TYPE public.payment_status TO service_role;

GRANT ALL ON TYPE public.subscription_status TO authenticated;
GRANT ALL ON TYPE public.subscription_status TO service_role;

REVOKE ALL ON FUNCTION private.current_organization_id() FROM PUBLIC;
GRANT ALL ON FUNCTION private.current_organization_id() TO authenticated;
GRANT ALL ON FUNCTION private.current_organization_id() TO service_role;

REVOKE ALL ON FUNCTION private.current_user_role() FROM PUBLIC;
GRANT ALL ON FUNCTION private.current_user_role() TO authenticated;
GRANT ALL ON FUNCTION private.current_user_role() TO service_role;

REVOKE ALL ON FUNCTION private.entitlement(target_organization_id uuid, entitlement_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.entitlement(target_organization_id uuid, entitlement_code text) TO authenticated;
GRANT ALL ON FUNCTION private.entitlement(target_organization_id uuid, entitlement_code text) TO service_role;

REVOKE ALL ON FUNCTION private.guard_deletion_identity_changes() FROM PUBLIC;

REVOKE ALL ON FUNCTION private.guard_organization_deletion_state() FROM PUBLIC;

REVOKE ALL ON FUNCTION private.has_application_read_access(target_organization_id uuid, evaluated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION private.has_application_read_access(target_organization_id uuid, evaluated_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION private.has_application_read_access(target_organization_id uuid, evaluated_at timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION private.has_application_write_access(target_organization_id uuid, evaluated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION private.has_application_write_access(target_organization_id uuid, evaluated_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION private.has_application_write_access(target_organization_id uuid, evaluated_at timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION private.has_entitlement(target_organization_id uuid, entitlement_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.has_entitlement(target_organization_id uuid, entitlement_code text) TO authenticated;
GRANT ALL ON FUNCTION private.has_entitlement(target_organization_id uuid, entitlement_code text) TO service_role;

REVOKE ALL ON FUNCTION private.has_organization_role(target_organization_id uuid, allowed_roles public.organization_member_role[]) FROM PUBLIC;
GRANT ALL ON FUNCTION private.has_organization_role(target_organization_id uuid, allowed_roles public.organization_member_role[]) TO authenticated;
GRANT ALL ON FUNCTION private.has_organization_role(target_organization_id uuid, allowed_roles public.organization_member_role[]) TO service_role;

REVOKE ALL ON FUNCTION private.is_active_organization_member(target_organization_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_active_organization_member(target_organization_id uuid) TO authenticated;
GRANT ALL ON FUNCTION private.is_active_organization_member(target_organization_id uuid) TO service_role;

REVOKE ALL ON FUNCTION private.is_active_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_active_profile() TO authenticated;
GRANT ALL ON FUNCTION private.is_active_profile() TO service_role;

REVOKE ALL ON FUNCTION private.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_admin() TO authenticated;
GRANT ALL ON FUNCTION private.is_admin() TO service_role;

REVOKE ALL ON FUNCTION private.is_organization_member(target_organization_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_organization_member(target_organization_id uuid) TO authenticated;
GRANT ALL ON FUNCTION private.is_organization_member(target_organization_id uuid) TO service_role;

REVOKE ALL ON FUNCTION private.is_platform_admin(candidate_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION private.is_platform_admin(candidate_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION private.prepare_report_photo() FROM PUBLIC;

REVOKE ALL ON FUNCTION private.set_company_line_organization() FROM PUBLIC;

REVOKE ALL ON FUNCTION private.set_report_child_organization() FROM PUBLIC;

REVOKE ALL ON FUNCTION private.storage_organization_id(object_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION private.storage_organization_id(object_name text) TO authenticated;
GRANT ALL ON FUNCTION private.storage_organization_id(object_name text) TO service_role;

REVOKE ALL ON FUNCTION private.subscription_access_mode(target_organization_id uuid, evaluated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION private.subscription_access_mode(target_organization_id uuid, evaluated_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION private.subscription_access_mode(target_organization_id uuid, evaluated_at timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.current_user_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.current_user_role() TO service_role;

REVOKE ALL ON FUNCTION public.get_user_access_context(candidate_user_id uuid, evaluated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_access_context(candidate_user_id uuid, evaluated_at timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.guard_customer_signature() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_customer_signature() TO service_role;

REVOKE ALL ON FUNCTION public.guard_installation_assignment_personnel_update() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_installation_assignment_personnel_update() TO service_role;

REVOKE ALL ON FUNCTION public.guard_signed_report_child_rows() FROM PUBLIC;
GRANT ALL ON FUNCTION public.guard_signed_report_child_rows() TO service_role;

REVOKE ALL ON FUNCTION public.is_active_profile() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_active_profile() TO service_role;

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;

REVOKE ALL ON FUNCTION public.is_platform_admin_for_user(candidate_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_platform_admin_for_user(candidate_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.log_admin_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.log_admin_change() TO service_role;

REVOKE ALL ON FUNCTION public.platform_change_plan(target_organization_id uuid, target_plan_id uuid, target_billing_interval public.billing_interval, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_change_plan(target_organization_id uuid, target_plan_id uuid, target_billing_interval public.billing_interval, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.platform_create_export_request(target_organization_id uuid, target_scope text, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_create_export_request(target_organization_id uuid, target_scope text, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.platform_dashboard_metrics() FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_dashboard_metrics() TO service_role;

REVOKE ALL ON FUNCTION public.platform_finish_organization_deletion(target_organization_id uuid, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_finish_organization_deletion(target_organization_id uuid, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.platform_list_export_requests(target_organization_id uuid, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_list_export_requests(target_organization_id uuid, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.platform_prepare_organization_deletion(target_organization_id uuid, confirmation_slug text, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_prepare_organization_deletion(target_organization_id uuid, confirmation_slug text, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.platform_purge_organization_data(target_organization_id uuid, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_purge_organization_data(target_organization_id uuid, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.platform_set_lifetime(target_organization_id uuid, enable_lifetime boolean, target_plan_id uuid, target_billing_interval public.billing_interval, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_set_lifetime(target_organization_id uuid, enable_lifetime boolean, target_plan_id uuid, target_billing_interval public.billing_interval, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.platform_set_organization_status(target_organization_id uuid, target_status public.organization_status, actor_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.platform_set_organization_status(target_organization_id uuid, target_status public.organization_status, actor_user_id uuid) TO service_role;

REVOKE ALL ON FUNCTION public.prepare_installation_assignment() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_installation_assignment() TO service_role;

REVOKE ALL ON FUNCTION public.prepare_report() FROM PUBLIC;
GRANT ALL ON FUNCTION public.prepare_report() TO service_role;

REVOKE ALL ON FUNCTION public.process_verified_payment_event(p_provider text, p_external_event_id text, p_event_type text, p_provider_customer_id text, p_provider_subscription_id text, p_external_payment_id text, p_amount_minor bigint, p_currency text, p_occurred_at timestamp with time zone, p_period_start_at timestamp with time zone, p_period_end_at timestamp with time zone, p_payload_hash text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.process_verified_payment_event(p_provider text, p_external_event_id text, p_event_type text, p_provider_customer_id text, p_provider_subscription_id text, p_external_payment_id text, p_amount_minor bigint, p_currency text, p_occurred_at timestamp with time zone, p_period_start_at timestamp with time zone, p_period_end_at timestamp with time zone, p_payload_hash text) TO service_role;

REVOKE ALL ON FUNCTION public.reconcile_organization_subscription(target_organization_id uuid, evaluated_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.reconcile_organization_subscription(target_organization_id uuid, evaluated_at timestamp with time zone) TO service_role;

REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_updated_at() TO service_role;

GRANT ALL ON FUNCTION public.validate_customer_signature(signature_value jsonb) TO anon;
GRANT ALL ON FUNCTION public.validate_customer_signature(signature_value jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.validate_customer_signature(signature_value jsonb) TO service_role;

GRANT ALL ON TABLE private.platform_admins TO service_role;

GRANT ALL ON TABLE private.platform_export_requests TO service_role;

GRANT ALL ON TABLE public.audit_logs TO service_role;
GRANT SELECT ON TABLE public.audit_logs TO authenticated;

GRANT ALL ON TABLE public.belts TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.belts TO authenticated;

GRANT ALL ON TABLE public.companies TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.companies TO authenticated;

GRANT ALL ON TABLE public.company_lines TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.company_lines TO authenticated;

GRANT ALL ON TABLE public.entitlements TO service_role;
GRANT SELECT ON TABLE public.entitlements TO authenticated;

GRANT ALL ON TABLE public.equipment TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.equipment TO authenticated;

GRANT ALL ON TABLE public.installation_assignments TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.installation_assignments TO authenticated;

GRANT ALL ON TABLE public.invoices TO service_role;
GRANT SELECT ON TABLE public.invoices TO authenticated;

GRANT ALL ON TABLE public.organization_members TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.organization_members TO authenticated;

GRANT ALL ON TABLE public.organizations TO service_role;
GRANT SELECT,UPDATE ON TABLE public.organizations TO authenticated;

GRANT ALL ON TABLE public.payment_events TO service_role;

GRANT ALL ON TABLE public.payments TO service_role;
GRANT SELECT ON TABLE public.payments TO authenticated;

GRANT ALL ON TABLE public.plans TO service_role;
GRANT SELECT ON TABLE public.plans TO anon;
GRANT SELECT ON TABLE public.plans TO authenticated;

GRANT ALL ON TABLE public.profiles TO service_role;
GRANT SELECT,UPDATE ON TABLE public.profiles TO authenticated;

GRANT ALL ON TABLE public.report_number_counters TO service_role;

GRANT ALL ON TABLE public.report_personnel TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.report_personnel TO authenticated;

GRANT ALL ON TABLE public.report_photos TO service_role;
GRANT SELECT,INSERT,DELETE ON TABLE public.report_photos TO authenticated;

GRANT ALL ON TABLE public.report_process_actions TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.report_process_actions TO authenticated;

GRANT ALL ON TABLE public.report_process_types TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.report_process_types TO authenticated;

GRANT ALL ON TABLE public.reports TO service_role;
GRANT SELECT,INSERT,UPDATE ON TABLE public.reports TO authenticated;

GRANT ALL ON TABLE public.subscriptions TO service_role;
GRANT SELECT ON TABLE public.subscriptions TO authenticated;

GRANT ALL ON TABLE public.vehicles TO service_role;
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE public.vehicles TO authenticated;

ALTER DEFAULT PRIVILEGES FOR ROLE ops_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE ops_owner IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE ops_owner IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE ops_owner IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE ops_owner IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES FOR ROLE ops_owner IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE ops_owner IN SCHEMA public GRANT ALL ON TABLES TO service_role;

--

-- ---------------------------------------------------------------------------
-- Dosya erisim politikalari (storage.objects)
-- ---------------------------------------------------------------------------

CREATE POLICY report_photo_objects_delete ON storage.objects FOR DELETE TO authenticated USING (((bucket_id = 'report-photos'::text) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE (((reports.id)::text = (storage.foldername(objects.name))[2]) AND (reports.organization_id = private.current_organization_id()) AND (NOT ((reports.status = 'SUBMITTED'::public.report_status) AND (reports.customer_signature IS NOT NULL))) AND (private.has_organization_role(reports.organization_id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role]) OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
           FROM public.report_photos
          WHERE ((report_photos.storage_path = objects.name) AND (report_photos.report_id = reports.id) AND (report_photos.organization_id = reports.organization_id) AND (report_photos.created_by = ( SELECT auth.uid() AS uid)))))))))));

CREATE POLICY report_photo_objects_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (((bucket_id = 'report-photos'::text) AND (owner_id = ( SELECT (auth.uid())::text AS uid)) AND (name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[A-Za-z0-9_-]{1,128}\.(jpg|jpeg|png|webp)$'::text) AND ((storage.foldername(name))[1] = (private.current_organization_id())::text) AND (EXISTS ( SELECT 1
   FROM public.reports
  WHERE (((reports.id)::text = (storage.foldername(objects.name))[2]) AND (reports.organization_id = private.current_organization_id()) AND (private.has_organization_role(reports.organization_id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role]) OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY report_photo_objects_select ON storage.objects FOR SELECT TO authenticated USING (((bucket_id = 'report-photos'::text) AND (EXISTS ( SELECT 1
   FROM (public.report_photos
     JOIN public.reports ON ((reports.id = report_photos.report_id)))
  WHERE ((report_photos.storage_path = objects.name) AND (report_photos.organization_id = private.current_organization_id()) AND (reports.organization_id = report_photos.organization_id) AND (private.has_organization_role(reports.organization_id, ARRAY['OWNER'::public.organization_member_role, 'ADMIN'::public.organization_member_role]) OR (reports.created_by_user_id = ( SELECT auth.uid() AS uid))))))));

CREATE POLICY subscription_delete_access ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated USING (((bucket_id <> 'report-photos'::text) OR private.has_application_write_access(private.storage_organization_id(name))));

CREATE POLICY subscription_insert_access ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (((bucket_id <> 'report-photos'::text) OR private.has_application_write_access(private.storage_organization_id(name))));

CREATE POLICY subscription_read_access ON storage.objects AS RESTRICTIVE FOR SELECT TO authenticated USING (((bucket_id <> 'report-photos'::text) OR private.has_application_read_access(private.storage_organization_id(name))));

-- ---------------------------------------------------------------------------
-- Private dosya alanlari
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('report-photos', 'report-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('organization-logos', 'organization-logos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp']);

