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

-- ---------- Live monitor (dashboard-design.md §4.1, §9) ----------
-- Rolling window (now - span), not calendar-aligned, so "1h" always means the
-- last 60 minutes. Peak and the window average come from the raw readings
-- (one scalar subquery each, not per bucket), so "peak" keeps its real
-- timestamp instead of snapping to a bucket edge; they're repeated on every
-- row so a single rpc() call carries both the chart and the readouts.
--   1h   -> 10s buckets (ESP32 cadence), ~360 points
--   24h  -> 5-minute buckets, 288 points
--   week -> 1-hour buckets, 168 points
create or replace function public.stats_live(p_device_id uuid, p_range text)
returns table (
  bucket_ts timestamptz,
  avg_power_w numeric,
  peak_power_w numeric,
  peak_ts timestamptz,
  window_avg_power_w numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  with bounds as (
    select
      now() as now_ts,
      case p_range
        when '1h' then interval '1 hour'
        when '24h' then interval '24 hours'
        when 'week' then interval '7 days'
      end as span,
      case p_range
        when '1h' then interval '10 seconds'
        when '24h' then interval '5 minutes'
        when 'week' then interval '1 hour'
      end as bucket
  ),
  window_rows as (
    select r.ts, r.power_w
    from public.readings r, bounds b
    where r.device_id = p_device_id
      and r.ts >= b.now_ts - b.span
  ),
  buckets as (
    select generate_series(
      date_bin(b.bucket, b.now_ts - b.span, 'epoch'::timestamptz),
      date_bin(b.bucket, b.now_ts, 'epoch'::timestamptz),
      b.bucket
    ) as bucket_ts
    from bounds b
  ),
  sums as (
    select date_bin(b.bucket, w.ts, 'epoch'::timestamptz) as bucket_ts, avg(w.power_w::float8) as avg_w
    from window_rows w, bounds b
    group by 1
  ),
  agg as (
    select
      (select w.power_w from window_rows w order by w.power_w desc, w.ts desc limit 1) as peak_power_w,
      (select w.ts from window_rows w order by w.power_w desc, w.ts desc limit 1) as peak_ts,
      (select avg(w.power_w::float8) from window_rows w) as window_avg
  )
  select
    bk.bucket_ts,
    round(s.avg_w::numeric, 1),
    round(a.peak_power_w::numeric, 1),
    a.peak_ts,
    round(a.window_avg::numeric, 1)
  from buckets bk
  left join sums s using (bucket_ts)
  cross join agg a
  order by bk.bucket_ts;
$$;

revoke execute on function public.stats_live(uuid, text) from public, anon;
grant execute on function public.stats_live(uuid, text) to authenticated, service_role;
