-- Smart Home Energy Monitor: tables, indexes, RLS policies, Realtime.
-- Run in the Supabase SQL Editor. Safe to re-run.

-- ---------- Tables ----------

create table if not exists public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid null references auth.users on delete set null,  -- null until linked
  name text,
  link_code text unique not null,                               -- printed on the device
  device_key_hash text not null,                                -- sha256 of the device secret
  created_at timestamptz not null default now()
);

-- One device per user
create unique index if not exists devices_one_per_user
  on public.devices (user_id) where user_id is not null;

create table if not exists public.readings (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices on delete cascade,
  ts timestamptz not null,
  current_a real not null check (current_a >= 0),
  power_w real not null check (power_w >= 0),
  energy_wh real not null check (energy_wh >= 0),  -- energy in this 10 s window
  is_seeded boolean not null default false
);

create index if not exists readings_device_ts on public.readings (device_id, ts);

create table if not exists public.alerts (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices on delete cascade,
  ts timestamptz not null default now(),
  type text not null check (type in ('anomaly', 'slab_warning')),
  message text,
  power_w real,
  emailed boolean not null default false
);

create index if not exists alerts_device_ts on public.alerts (device_id, ts desc);

create table if not exists public.tariff_slabs (
  id int primary key,
  min_units int not null,
  max_units int null,                 -- null = no upper limit
  rate_per_unit numeric not null      -- PKR, from the latest bill
);

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  email_alerts boolean not null default true,
  alert_email text
);

-- ---------- Row Level Security ----------
-- Users can only read rows that belong to their own device.
-- No insert/update/delete policies on readings or alerts: only the server
-- (service-role key, which bypasses RLS) writes them.

alter table public.devices       enable row level security;
alter table public.readings      enable row level security;
alter table public.alerts        enable row level security;
alter table public.tariff_slabs  enable row level security;
alter table public.user_settings enable row level security;

drop policy if exists "own device" on public.devices;
create policy "own device" on public.devices
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own readings" on public.readings;
create policy "own readings" on public.readings
  for select to authenticated
  using (device_id in (select id from public.devices where user_id = (select auth.uid())));

drop policy if exists "own alerts" on public.alerts;
create policy "own alerts" on public.alerts
  for select to authenticated
  using (device_id in (select id from public.devices where user_id = (select auth.uid())));

drop policy if exists "read slabs" on public.tariff_slabs;
create policy "read slabs" on public.tariff_slabs
  for select to authenticated
  using (true);

drop policy if exists "own settings read" on public.user_settings;
create policy "own settings read" on public.user_settings
  for select to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists "own settings update" on public.user_settings;
create policy "own settings update" on public.user_settings
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------- Realtime ----------
-- The dashboard subscribes to new readings (RLS still applies).

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'readings'
  ) then
    alter publication supabase_realtime add table public.readings;
  end if;
end $$;

-- ---------- Tariff slabs ----------
-- Fill from a real, current bill (energy charge per unit, PKR). Don't invent rates.
-- Example shape only:
-- insert into public.tariff_slabs (id, min_units, max_units, rate_per_unit) values
--   (1,   1, 100, <rate>),
--   (2, 101, 200, <rate>),
--   (3, 201, 300, <rate>),
--   (4, 301, null, <rate>)
-- on conflict (id) do update set
--   min_units = excluded.min_units, max_units = excluded.max_units, rate_per_unit = excluded.rate_per_unit;
