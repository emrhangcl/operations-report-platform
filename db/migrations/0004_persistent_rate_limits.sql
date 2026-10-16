-- Kalici hiz siniri sayaclari.
--
-- Sayaclar uygulama surecinin belleginde degil veritabaninda tutulur: sunucu yeniden
-- basladiginda sifirlanmaz ve birden fazla uygulama sureci ayni sinirlari paylasir.
-- Tablo istek rollerine acik degildir; yalnizca asagidaki SECURITY DEFINER fonksiyonlari
-- service_role uzerinden kullanilir.

create table private.rate_limit_buckets (
  key text primary key,
  window_started_at timestamptz not null,
  hits integer not null,
  constraint rate_limit_buckets_key_length check (length(key) between 1 and 300),
  constraint rate_limit_buckets_hits_positive check (hits > 0)
);

create index rate_limit_buckets_window_idx on private.rate_limit_buckets (window_started_at);

alter table private.rate_limit_buckets enable row level security;
revoke all on table private.rate_limit_buckets from public;

-- Sayaci bir artirir; pencere dolmussa yeni pencere baslatir.
create function private.consume_rate_limit(p_key text, p_limit integer, p_window_seconds integer)
returns table (is_allowed boolean, current_hits integer, retry_after_seconds integer)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  bucket private.rate_limit_buckets%rowtype;
  window_length interval;
begin
  if p_limit < 1 or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'Gecersiz hiz siniri parametresi.' using errcode = '22023';
  end if;

  window_length := make_interval(secs => p_window_seconds);

  insert into private.rate_limit_buckets as b (key, window_started_at, hits)
  values (p_key, now(), 1)
  on conflict (key) do update
    set hits = case when b.window_started_at + window_length <= now() then 1 else b.hits + 1 end,
        window_started_at = case when b.window_started_at + window_length <= now() then now() else b.window_started_at end
  returning * into bucket;

  -- Suresi gecmis sayaclar zaman zaman temizlenir.
  if random() < 0.01 then
    delete from private.rate_limit_buckets where window_started_at < now() - interval '1 day';
  end if;

  return query select
    bucket.hits <= p_limit,
    bucket.hits,
    greatest(1, ceil(extract(epoch from (bucket.window_started_at + window_length - now())))::integer);
end;
$$;

-- Sayaci artirmadan mevcut penceredeki sayiyi dondurur.
create function private.peek_rate_limit(p_key text, p_window_seconds integer)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select hits
      from private.rate_limit_buckets
     where key = p_key
       and window_started_at + make_interval(secs => p_window_seconds) > now()
  ), 0)
$$;

-- Bir anahtarin sayacini sifirlar (or. basarili giristen sonra).
create function private.reset_rate_limit(p_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from private.rate_limit_buckets where key = p_key
$$;

revoke all on function private.consume_rate_limit(text, integer, integer) from public;
revoke all on function private.peek_rate_limit(text, integer) from public;
revoke all on function private.reset_rate_limit(text) from public;
grant execute on function private.consume_rate_limit(text, integer, integer) to service_role;
grant execute on function private.peek_rate_limit(text, integer) to service_role;
grant execute on function private.reset_rate_limit(text) to service_role;
