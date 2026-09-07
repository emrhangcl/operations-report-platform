-- Customer representative approval captured as bounded, replayable vector data.
alter table public.reports
  add column if not exists customer_signature jsonb,
  add column if not exists customer_signed_at timestamptz,
  add column if not exists customer_signed_by uuid references public.profiles(id) on delete set null,
  add column if not exists customer_signature_required boolean not null default false;

create or replace function public.validate_customer_signature(signature_value jsonb)
returns boolean
language plpgsql
immutable
set search_path = public
as $$
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

create or replace function public.guard_customer_signature()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  submitting boolean;
  signed_report_locked boolean;
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
          'customer_signed_by'
        ])
       is distinct from
       (to_jsonb(old) - array[
          'updated_at',
          'created_by_user_id',
          'belt_id',
          'observer_personnel_id',
          'updated_by_user_id',
          'customer_signed_by'
    ]) then
      raise exception 'İmzalı rapor içeriği gönderimden sonra değiştirilemez.';
    end if;

    if new.updated_by_user_id is distinct from old.updated_by_user_id
       and not (fk_nulling and old.updated_by_user_id is not null and new.updated_by_user_id is null) then
      raise exception 'İmzalı raporun güncelleyen kullanıcı kaydı değiştirilemez.';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists reports_customer_signature_guard on public.reports;
drop trigger if exists reports_zz_customer_signature_guard on public.reports;
create trigger reports_zz_customer_signature_guard
before insert or update on public.reports
for each row execute function public.guard_customer_signature();

create or replace function public.guard_signed_report_child_rows()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

drop trigger if exists report_personnel_signed_report_guard on public.report_personnel;
create trigger report_personnel_signed_report_guard
before insert or update or delete on public.report_personnel
for each row execute function public.guard_signed_report_child_rows();

drop trigger if exists report_process_types_signed_report_guard on public.report_process_types;
create trigger report_process_types_signed_report_guard
before insert or update or delete on public.report_process_types
for each row execute function public.guard_signed_report_child_rows();

drop trigger if exists report_process_actions_signed_report_guard on public.report_process_actions;
create trigger report_process_actions_signed_report_guard
before insert or update or delete on public.report_process_actions
for each row execute function public.guard_signed_report_child_rows();

drop trigger if exists report_photos_signed_report_guard on public.report_photos;
create trigger report_photos_signed_report_guard
before insert or update or delete on public.report_photos
for each row execute function public.guard_signed_report_child_rows();

drop policy if exists report_photo_objects_update on storage.objects;
drop policy if exists report_photo_objects_delete on storage.objects;
create policy report_photo_objects_delete on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-photos'
  and exists (
    select 1
      from public.reports
     where reports.id::text = (storage.foldername(objects.name))[2]
       and reports.organization_id = private.current_organization_id()
       and not (
         reports.status = 'SUBMITTED'::public.report_status
         and reports.customer_signature is not null
       )
       and (
         private.has_organization_role(
           reports.organization_id,
           array['OWNER', 'ADMIN']::public.organization_member_role[]
         )
         or reports.created_by_user_id = (select auth.uid())
         or exists (
           select 1
             from public.report_photos
            where report_photos.storage_path = objects.name
              and report_photos.report_id = reports.id
              and report_photos.organization_id = reports.organization_id
              and report_photos.created_by = (select auth.uid())
         )
       )
  )
);

revoke execute on function public.guard_customer_signature() from public, anon, authenticated;
revoke execute on function public.guard_signed_report_child_rows() from public, anon, authenticated;

comment on column public.reports.customer_signature is 'Versioned customer approval vector: {version, signer_name, signer_title, consent, strokes}; immutable with report contents after submission.';
comment on column public.reports.customer_signed_at is 'Database timestamp assigned when a report first transitions to SUBMITTED with customer approval.';
comment on column public.reports.customer_signed_by is 'Authenticated profile that submitted the customer approval; nullable only through profile deletion history preservation.';
comment on column public.reports.customer_signature_required is 'Report-specific rollout marker set by clients that support customer approval; not a role, security, or tenant authorization claim.';
comment on function public.validate_customer_signature(jsonb) is 'Strict validator matching packages/validation customerSignatureSchema for version 1 customer signature JSON.';
