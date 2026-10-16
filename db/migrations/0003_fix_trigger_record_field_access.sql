-- Birden fazla tabloda calisan tetikleyici fonksiyonlarinda kayit alani erisimi duzeltmesi.
--
-- PL/pgSQL bir ifadede gecen NEW/OLD alanlarinin tipini ifade planlanirken cozer; `and` ile kisa
-- devre yapilsa bile tabloda olmayan bir alan `record "new" has no field ...` hatasi uretir.
-- Asagidaki iki fonksiyon bu nedenle bazi tablolarda hic calisamiyordu:
--
--   private.set_report_child_organization()
--     report_process_types / report_process_actions eklemeleri `new.profile_id` yuzunden basarisizdi.
--
--   public.guard_signed_report_child_rows()
--     Imzali rapora bagli personel silinirken (ON DELETE SET NULL) `old.created_by` yuzunden
--     report_personnel guncellemesi basarisizdi; personel silme islemi tamamlanamiyordu.
--
-- Tabloya ozel alanlar artik yalnizca ilgili tablo dalinda ve satirin JSON gosteriminden okunur.
-- Is kurallari degismez.

create or replace function private.set_report_child_organization()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  parent_organization_id uuid;
  linked_profile_id uuid;
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

  if tg_table_name = 'report_personnel' then
    linked_profile_id := (to_jsonb(new) ->> 'profile_id')::uuid;

    if linked_profile_id is not null then
      select organization_id
        into linked_profile_organization_id
        from public.profiles
       where id = linked_profile_id;

      if linked_profile_organization_id is distinct from parent_organization_id then
        raise exception 'Başka firmaya ait personel rapora eklenemez.';
      end if;
    end if;
  end if;

  new.organization_id = parent_organization_id;
  return new;
end;
$$;

revoke all on function private.set_report_child_organization() from public;

create or replace function public.guard_signed_report_child_rows()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  fk_nulling boolean := false;
  fk_column text;
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

  -- Silinen profil gecmisini korumak icin yalnizca yabanci anahtarin NULL'a cekilmesine izin verilir.
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and old.report_id is not distinct from new.report_id then
    fk_column := case tg_table_name
      when 'report_personnel' then 'profile_id'
      when 'report_photos' then 'created_by'
    end;

    if fk_column is not null then
      fk_nulling := (to_jsonb(old) ->> fk_column) is not null
        and (to_jsonb(new) ->> fk_column) is null
        and (to_jsonb(new) - fk_column) is not distinct from (to_jsonb(old) - fk_column);
    end if;
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

revoke all on function public.guard_signed_report_child_rows() from public;
grant all on function public.guard_signed_report_child_rows() to service_role;
