begin;

update public.belts
set code = coalesce(nullif(btrim(code), ''), nullif(btrim(name), ''), 'BANT-' || left(id::text, 8))
where code is null or btrim(code) = '';

alter table public.belts
  alter column code set not null,
  alter column name drop not null;

commit;
