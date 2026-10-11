-- Voltage: a nullable voltage_v on readings (the PZEM-004T measures it; older rows
-- and the seed have none), a 'voltage' alert type, and the Overview's voltage chart.
-- Run once in the Supabase SQL editor, after schema.sql and stats.sql. Safe to re-run.

alter table public.readings
  add column if not exists voltage_v real
  check (voltage_v is null or (voltage_v >= 0 and voltage_v <= 500));

-- Allow alerts of type 'voltage'. The original check was declared inline, so look it
-- up by what it checks rather than trusting its generated name.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.alerts'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) like '%type%'
  loop
    execute format('alter table public.alerts drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.alerts
  add constraint alerts_type_check check (type in ('anomaly', 'slab_warning', 'voltage'));

-- Voltage over a rolling window, bucketed like stats_live (supabase/stats.sql):
--   1h -> 10 s buckets, 24h -> 5-minute buckets, week -> 1-hour buckets.
-- avg and max per bucket (a short surge shows in max even when the average hides it),
-- plus the latest reading and the window's max, repeated on every row.
create or replace function public.voltage_live(p_device_id uuid, p_range text)
returns table (
  bucket_ts timestamptz,
  avg_voltage_v numeric,
  max_voltage_v numeric,
  latest_voltage_v numeric,
  latest_ts timestamptz,
  window_max_voltage_v numeric
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
    select r.ts, r.voltage_v
    from public.readings r, bounds b
    where r.device_id = p_device_id
      and r.ts >= b.now_ts - b.span
      and r.voltage_v is not null
  ),
  sums as (
    select date_bin(b.bucket, w.ts, 'epoch'::timestamptz) as bucket_ts,
           avg(w.voltage_v::float8) as avg_v,
           max(w.voltage_v::float8) as max_v
    from window_rows w, bounds b
    group by 1
  ),
  agg as (
    select
      (select w.voltage_v from window_rows w order by w.ts desc limit 1) as latest_v,
      (select w.ts from window_rows w order by w.ts desc limit 1) as latest_ts,
      (select max(w.voltage_v) from window_rows w) as window_max
  )
  select
    s.bucket_ts,
    round(s.avg_v::numeric, 1),
    round(s.max_v::numeric, 1),
    round(a.latest_v::numeric, 1),
    a.latest_ts,
    round(a.window_max::numeric, 1)
  from sums s
  cross join agg a
  order by s.bucket_ts;
$$;

revoke execute on function public.voltage_live(uuid, text) from public, anon;
grant execute on function public.voltage_live(uuid, text) to authenticated, service_role;
