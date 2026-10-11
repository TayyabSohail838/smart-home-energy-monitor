-- Stats functions, called from the API with supabase.rpc(...).
-- Run in the Supabase SQL Editor after schema.sql. Safe to re-run.
-- They run as the calling user (security invoker), so RLS still applies:
-- a user can only ever aggregate their own device's readings.

-- ---------- Usage history (Step 8) ----------
-- kWh per bucket in Asia/Karachi time. kWh = sum(energy_wh) / 1000.
--   day   -> 24 hourly buckets for today (future hours = null)
--   week  -> last 7 days, daily
--   month -> this calendar month so far, daily
--   30d   -> last 30 days, daily
create or replace function public.usage_history(p_device_id uuid, p_range text)
returns table (bucket text, kwh numeric)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      local_now,
      case when p_range = 'day' then 'hour' else 'day' end as unit,
      case p_range
        when 'day'   then date_trunc('day', local_now)
        when 'week'  then date_trunc('day', local_now) - interval '6 days'
        when 'month' then date_trunc('month', local_now)
        when '30d'   then date_trunc('day', local_now) - interval '29 days'
      end as local_start,
      case when p_range = 'day'
        then date_trunc('day', local_now) + interval '23 hours'
        else date_trunc('day', local_now)
      end as local_last
    from (select now() at time zone 'Asia/Karachi' as local_now) n
  ),
  buckets as (
    select generate_series(b.local_start, b.local_last, ('1 ' || b.unit)::interval) as b_start
    from bounds b
  ),
  sums as (
    select
      date_trunc(b.unit, r.ts at time zone 'Asia/Karachi') as b_start,
      sum(r.energy_wh::float8) / 1000 as kwh
    from public.readings r, bounds b
    where r.device_id = p_device_id
      and r.ts >= (b.local_start at time zone 'Asia/Karachi')
    group by 1
  )
  select
    to_char(bk.b_start, case when b.unit = 'hour' then 'YYYY-MM-DD"T"HH24:00' else 'YYYY-MM-DD' end),
    case when bk.b_start > b.local_now then null
         else round(coalesce(s.kwh, 0)::numeric, 3) end
  from buckets bk
  cross join bounds b
  left join sums s using (b_start)
  order by bk.b_start;
$$;

revoke execute on function public.usage_history(uuid, text) from public, anon;
grant execute on function public.usage_history(uuid, text) to authenticated, service_role;

-- ---------- Hourly profile (Step 9 peak hours, reused by Step 11 anomaly) ----------
-- For each hour of the day (0-23, Asia/Karachi) over the last p_days days:
-- mean and standard deviation of power_w, and how many readings went in.
create or replace function public.hourly_profile(p_device_id uuid, p_days int default 14)
returns table (hour int, avg_power_w numeric, stddev_power_w numeric, samples bigint)
language sql
stable
security invoker
set search_path = public
as $$
  with per_hour as (
    select
      extract(hour from r.ts at time zone 'Asia/Karachi')::int as hr,
      avg(r.power_w::float8) as avg_w,
      stddev_pop(r.power_w::float8) as sd_w,
      count(*) as n
    from public.readings r
    where r.device_id = p_device_id
      and r.ts >= now() - make_interval(days => least(greatest(p_days, 1), 60))
    group by 1
  )
  select
    h,
    round(coalesce(p.avg_w, 0)::numeric, 1),
    round(coalesce(p.sd_w, 0)::numeric, 1),
    coalesce(p.n, 0)
  from generate_series(0, 23) as h
  left join per_hour p on p.hr = h
  order by h;
$$;

revoke execute on function public.hourly_profile(uuid, int) from public, anon;
grant execute on function public.hourly_profile(uuid, int) to authenticated, service_role;
