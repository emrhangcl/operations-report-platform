begin;

create or replace function public.guard_customer_signature()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
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

drop policy if exists reports_update_owner_draft_or_admin on public.reports;
create policy reports_update_owner_draft_or_admin on public.reports
for update
to authenticated
using (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (
      private.is_active_organization_member(organization_id)
      and created_by_user_id = (select auth.uid())
      and (
        status = 'DRAFT'::public.report_status
        or (status = 'SUBMITTED'::public.report_status and customer_signature is not null)
      )
    )
  )
)
with check (
  organization_id = private.current_organization_id()
  and (
    private.is_admin()
    or (
      private.is_active_organization_member(organization_id)
      and created_by_user_id = (select auth.uid())
      and (
        status = 'DRAFT'::public.report_status
        or (status = 'SUBMITTED'::public.report_status and customer_signature is not null)
      )
    )
  )
);

revoke execute on function public.guard_customer_signature() from public, anon, authenticated;

comment on function public.guard_customer_signature() is
  'Locks customer-approved report content after submission while permitting audited updates to factory_return_at and vehicle_end_km as post-service return closeout data.';

commit;
