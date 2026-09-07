begin;

alter table public.reports
  alter column created_by_user_id drop not null;

alter table public.report_photos
  alter column created_by drop not null;

alter table public.installation_assignments
  alter column assigned_to_profile_id drop not null;

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add constraint profiles_id_fkey
  foreign key (id)
  references auth.users(id)
  on delete cascade;

alter table public.reports
  drop constraint if exists reports_created_by_user_id_fkey;

alter table public.reports
  add constraint reports_created_by_user_id_fkey
  foreign key (created_by_user_id)
  references public.profiles(id)
  on delete set null;

alter table public.report_photos
  drop constraint if exists report_photos_created_by_fkey;

alter table public.report_photos
  add constraint report_photos_created_by_fkey
  foreign key (created_by)
  references public.profiles(id)
  on delete set null;

alter table public.installation_assignments
  drop constraint if exists installation_assignments_assigned_to_profile_id_fkey;

alter table public.installation_assignments
  add constraint installation_assignments_assigned_to_profile_id_fkey
  foreign key (assigned_to_profile_id)
  references public.profiles(id)
  on delete set null;

create or replace function public.prepare_report()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  creator record;
  selected_company record;
  selected_belt record;
  selected_observer record;
  seq integer;
  report_year integer;
begin
  if tg_op = 'INSERT' then
    new.created_by_user_id = coalesce(new.created_by_user_id, auth.uid());
  else
    new.updated_by_user_id = auth.uid();
  end if;

  if new.created_by_user_id is null then
    if tg_op = 'INSERT' then
      raise exception 'Aktif kullanıcı profili bulunamadı.';
    end if;

    new.created_by_name_snapshot = coalesce(
      nullif(new.created_by_name_snapshot, ''),
      old.created_by_name_snapshot,
      'Silinmiş personel'
    );
  else
    select first_name, last_name
      into creator
      from public.profiles
     where id = new.created_by_user_id;

    if creator.first_name is null then
      raise exception 'Aktif kullanıcı profili bulunamadı.';
    end if;

    new.created_by_name_snapshot = trim(creator.first_name || ' ' || creator.last_name);
  end if;

  if new.company_id is not null then
    select name, address, contact_name, contact_phone
      into selected_company
      from public.companies
     where id = new.company_id;

    new.company_name_snapshot = selected_company.name;
    new.company_address_snapshot = selected_company.address;
    new.company_contact_name = coalesce(nullif(new.company_contact_name, ''), selected_company.contact_name);
    new.company_contact_phone = coalesce(nullif(new.company_contact_phone, ''), selected_company.contact_phone);
  end if;

  if new.belt_id is not null then
    select name, code
      into selected_belt
      from public.belts
     where id = new.belt_id;

    new.belt_name_snapshot = selected_belt.name;
    new.belt_code_snapshot = selected_belt.code;
  end if;

  if new.observer_personnel_id is not null then
    select first_name, last_name
      into selected_observer
      from public.profiles
     where id = new.observer_personnel_id;

    new.observer_name_snapshot = trim(selected_observer.first_name || ' ' || selected_observer.last_name);
  end if;

  if new.status = 'SUBMITTED' and new.report_number is null then
    report_year = extract(year from new.report_date)::integer;

    insert into public.report_number_counters (year, next_value)
    values (report_year, 2)
    on conflict (year)
    do update
      set next_value = public.report_number_counters.next_value + 1,
          updated_at = now()
    returning next_value - 1 into seq;

    new.report_year = report_year;
    new.sequence_number = seq;
    new.report_number = 'RPR-' || report_year::text || '-' || lpad(seq::text, 6, '0');
    new.submitted_at = coalesce(new.submitted_at, now());
  end if;

  return new;
end;
$$;

commit;
