# CLAUDE.md — Smart Home Energy Monitor (Backend)

Backend for a 24-hour hackathon project. An ESP32 with an SCT-013 clamp posts electricity readings every 10 seconds; this backend stores them, runs anomaly and tariff-slab checks, sends alert emails, and serves stats to the dashboard.

The full design lives in the "Smart Home Energy Monitor: System Architecture" doc. This file is the working summary for the backend only.

## Scope

**Build:** reading ingestion, device linking, stats (summary, history, peak hours), anomaly detection, slab-based bill estimate, alerts (stored + emailed), seed script, weather-based usage forecast + suggestions (built last, first to cut).

**Do not build:** ML models or trained datasets, LLM tips, appliance detection (NILM), manual appliance entry, voltage tracking, multiple devices per user, per-user location. These are roadmap or dropped. Don't add them, even partially.

Time is the main constraint. Prefer the simplest thing that works and is easy to explain to judges.

## Stack

| Layer | Choice |
| --- | --- |
| Framework | Next.js (App Router), route handlers in `app/api/**/route.js` |
| Language | JavaScript (not TypeScript) |
| Database | Supabase Postgres |
| Auth | Supabase Auth (email + password), via `@supabase/ssr` |
| Live updates | Supabase Realtime on `readings` inserts (dashboard subscribes; backend just inserts) |
| Email | Resend |
| Hosting | Vercel |
| Dev machine | Windows; APIs tested with Postman |

No separate Python service. All analytics are plain statistics in JavaScript or SQL.

## Commands

```bash
npm install
npm run dev          # http://localhost:3000
npm run build
npm run lint
npm run seed         # writes 30 days of sample readings (see Seed data)
```

## Folder structure

```
app/
  api/
    readings/route.js        # POST  - ESP32 ingestion (device key auth)
    devices/link/route.js    # POST  - link device to logged-in user
    stats/summary/route.js   # GET   - today/month kWh, bill, slab info
    stats/history/route.js   # GET   - ?range=day|week|month|30d
    stats/peak-hours/route.js# GET   - avg power per hour + top 3
    alerts/route.js          # GET   - user's alerts, newest first
    settings/route.js        # GET, PATCH - email_alerts on/off, alert_email
    forecast/route.js        # GET   - ?months=1-12: 14-day weather + monthly outlook, kWh/bill, suggestions
lib/
  supabase/server.js         # cookie-based client for user requests
  supabase/admin.js          # service-role client (server only)
  deviceAuth.js              # hash + verify x-device-key
  anomaly.js                 # anomaly rule
  bill.js                    # slab pricing + month-end projection
  alerts.js                  # create alert row + send email
  email.js                   # Resend wrapper
  weather.js                 # Open-Meteo: daily temps, seasonal forecast, 5-year normals
  forecast.js                # temperature → kWh regression + suggestion rules
supabase/
  schema.sql                 # tables, indexes, RLS policies
scripts/
  seed.js                    # sample history generator
```

## Environment variables

Stored in `.env.local` (never committed) and in Vercel project settings.

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=      # server only, never in client code
RESEND_API_KEY=
ALERT_FROM_EMAIL=
HOME_LAT=                       # home city for weather (one fixed location)
HOME_LON=
```

## Data model

```sql
devices (
  id uuid pk default gen_random_uuid(),
  user_id uuid null references auth.users,   -- null until linked
  name text,
  link_code text unique not null,            -- printed on the device
  device_key_hash text not null,             -- sha256 of the device secret
  created_at timestamptz default now()
)

readings (
  id bigint generated always as identity pk,
  device_id uuid references devices not null,
  ts timestamptz not null,
  current_a real not null,
  power_w real not null,
  energy_wh real not null,                   -- energy in this 10 s window
  is_seeded boolean default false
)
-- index on readings (device_id, ts)

alerts (
  id bigint generated always as identity pk,
  device_id uuid references devices not null,
  ts timestamptz default now(),
  type text check (type in ('anomaly','slab_warning')),
  message text,
  power_w real,
  emailed boolean default false
)

tariff_slabs (
  id int pk,
  min_units int not null,
  max_units int null,                        -- null = no upper limit
  rate_per_unit numeric not null             -- PKR, filled from the latest bill
)

user_settings (
  user_id uuid pk references auth.users,
  email_alerts boolean default true,
  alert_email text
)
```

One device per user: enforce with a unique index on `devices.user_id` (where not null).

Tariff rates are not hard-coded in code. They live in `tariff_slabs`, loaded from `supabase/tariff.sql`: NEPRA SRO 279(I)/2026 unprotected residential rates (same for FESCO/Faisalabad). Replace them with a real bill's rates if they differ.

## API contracts

### `POST /api/readings` (called by the ESP32)

- Header: `x-device-key: <secret>` and the device id in the body or header.
- Body: `{ "device_id": "...", "ts": "2026-10-11T14:05:10Z", "current_a": 4.82, "power_w": 1109, "energy_wh": 3.08 }`
- Also accept an array of readings (the ESP32 sends a backlog after reconnecting).
- Steps: verify key hash → validate fields → insert with the service-role client → run anomaly check → run slab check → return `201 { ok: true }`.
- Errors: `401` bad key, `400` invalid body. Keep responses tiny; the ESP32 only reads the status code.
- Alert checks must never make the insert fail. Wrap them in try/catch and log.

### `POST /api/devices/link` (logged-in user)

- Body: `{ "link_code": "ABC123" }`. Sets `devices.user_id` to the current user if the device is unlinked and the user has no device yet.

### `GET /api/stats/summary`

Returns `{ today_kwh, month_kwh, bill_so_far, current_slab, units_to_next_slab, projected_month_kwh, projected_bill, projected_slab, days_passed, days_in_month, slab_mode, currency, excludes_taxes: true }`.

### `GET /api/stats/history?range=day|week|month|30d`

- `day`: kWh per hour for today. `week` (last 7 days), `month` (this calendar month), `30d` (last 30 days): kWh per day.
- Grouping runs in the Postgres function `usage_history` (`supabase/stats.sql`).
- Sum `energy_wh / 1000`; don't integrate power again.

### `GET /api/stats/peak-hours`

Returns 24 items `{ hour, avg_power_w }` plus `top_hours` (the 3 highest).

### `GET /api/alerts`

User's alerts, newest first, limit 50: `{ alerts: [{ id, ts, type, message, power_w, emailed }] }`.

### `GET` / `PATCH /api/settings`

`{ email_alerts, alert_email }`. PATCH accepts either or both fields. The row is created when the user links a device.

### `GET /api/forecast?months=1-12` (default 12)

Returns `{ model, this_month: { month, projected_kwh, projected_bill, ac_kwh_est }, next_days: [{ date, weekday, condition, icon, temp_max_c, temp_min_c, temp_mean_c, rain_chance_pct, rain_mm, wind_max_kmh, humidity_pct, sunrise, sunset, predicted_kwh }] (14), outlook: { headline, decreasing: [{ item, detail }], increasing: [{ item, detail }], months: [{ month, year, days, season, forecast_temp_c, likely_range_c, normal_temp_c, vs_normal_c, weather_basis: forecast|mixed|normals, weather_source, sunset, daylight_h, predicted_kwh, ac_kwh_est, predicted_bill, predicted_slab, change_pct }] }, year: { summary, total_kwh, total_bill, cheapest_month, most_expensive_month, ac_season_returns, ac_peak_month, weather_basis } | null (when months <= 3), weather_share_label, suggestions: [{ type, message }], excludes_taxes: true }`. `400` bad months, `422` if fewer than 7 days of usage.

All user-facing routes get the user from the Supabase session and return `401` if there is none. They only ever read the user's own device.

## Analytics rules

**Peak hours:** last 14 days of readings → group by hour of day in `Asia/Karachi` time → average `power_w` → top 3 hours.

**Anomaly detection:**
1. Baseline for the current hour of day over the last 14 days: mean μ and standard deviation σ of `power_w`.
2. Average power over the latest 5 minutes.
3. Anomaly if `avg > μ + 3σ` **and** `avg − μ > 300 W`.
4. Cooldown: at most one anomaly alert per device per 30 minutes.

**Bill estimate:**
1. Month kWh = sum of this month's `energy_wh / 1000` (Asia/Karachi calendar month).
2. Price it with `tariff_slabs`. Keep the pricing function in `lib/bill.js`; the mode is the single option `SLAB_MODE`: `single_rate` (all units at the rate of the slab the total falls in; unprotected, the default) or `tiered` (each slab at its own rate).
3. Projection = month kWh ÷ days passed × days in month (days passed is fractional, in Karachi time).
4. Slab warning when the projection crosses into a higher slab. At most once per slab per month.
5. Energy charge only. Taxes, fuel adjustment and fixed charges are excluded, and the API response should say so (`excludes_taxes: true`).

**Usage forecast (weather-based):**
1. Weather comes from Open-Meteo (free, no API key, plain `fetch`, cached in memory). Recent past days + next 14 days: forecast API (conditions from WMO weather codes, high/low, rain chance and mm, wind, humidity, sunrise/sunset; `past_days` because the archive API lags ~5 days). Next months: seasonal API (ECMWF, ~51 ensemble runs, max 217 days ≈ Nov–Apr from October). It predicts monthly tendencies, not exact daily weather; say so. Months beyond it use 5-year normals and are labelled `weather_basis: normals` (partly covered = `mixed`, no likely range). Normals and sunset times: archive API, last 5 full years.
2. Cooling degrees `CDD = max(0, daily mean temp − 24°C)`.
3. Fit `daily_kwh = a + b × CDD` with simple linear regression on the user's past days (plain JS, no library). `a` = base load, `b` = extra kWh per degree of heat (mostly AC). Report R².
4. Each outlook month (default 12): average the ensemble's daily CDD (normal-basis days: average CDD over all past days of that month, not CDD of the average) → `predicted_kwh = days × (a + b × CDD)`, priced with `lib/bill.js`. `ac_kwh_est = days × b × CDD`. Likely range = 10th–90th percentile of the runs' monthly means. Season label from the forecast temperature.
5. Headline and the down/up lists cover the next 3 months; `year` summarises all months (totals, cheapest/most expensive, when AC season returns and peaks). Outlook lists what goes down/up: AC (from `ac_kwh_est`), lighting (earlier/later sunset), heating (months below 17°C). Lighting and heating are described, not added to kWh: the model has no cold-day data to measure them.
6. Suggestions are fixed if/then rules with templates (no LLM): rising/falling/steady usage, units per day to stay in a cheaper slab, hot/mild days ahead (daytime highs), likely thunderstorms, LED lighting, winter heating.
7. The weather-driven part is an estimate, not measured AC use. Label it "weather-driven usage (est.)" in the API and UI.

**Alerts:** insert into `alerts`, then email via Resend if `user_settings.email_alerts` is on. Set `emailed = true` on success. Email failure is logged, never thrown. Without a verified domain, `onboarding@resend.dev` only delivers to the Resend account's own email (inovixco@gmail.com). The slab warning check is throttled to once per 10 minutes per device; "once per slab per month" is enforced by the slab name in the alert message.

## Security rules

- The service-role key is used only in `lib/supabase/admin.js` and only from route handlers. It must never be imported into client components.
- Store only the SHA-256 hash of device keys. Compare with a constant-time check.
- RLS on: users can `select` only rows whose device belongs to them. No client-side inserts into `readings` or `alerts`.
- Validate every request body (types, ranges: `current_a >= 0`, `power_w >= 0`, `ts` within the last day and not in the future).

## Seed data

`scripts/seed.js` writes 30 days of readings at 10 s intervals for one demo device, `is_seeded = true`:
- Night low (fridge, fans), a morning bump, an evening peak (lights, AC, iron, TV).
- Small random noise; weekends slightly higher.
- AC load follows the real hourly temperatures for those days (Open-Meteo forecast API with `past_days`; the archive API lags ~5 days), so the forecast regression has a real pattern to learn.
- 2–3 planted spikes so anomalies and graphs have something to show.
- Insert in batches of about 1,000 rows.
- Re-running it deletes old seeded rows first (`is_seeded = true` only, never real readings).

## Conventions

- Times are stored in UTC; grouping by hour/day/month uses `Asia/Karachi`.
- Units in names: `_a`, `_w`, `_wh`, `_kwh`.
- Route handlers stay thin; logic goes in `lib/`.
- Return JSON `{ error: "message" }` with a proper status on failure.
- Prefer SQL aggregation (Supabase RPC or views) over pulling thousands of rows into JS when a query gets slow.

## Testing

- Test each route in Postman before wiring the dashboard. Keep a Postman request for `POST /api/readings` with a sample body and device key so the backend works before the hardware does.
- After the seed script runs, check: peak hours return 24 items, summary returns a bill, and a planted spike produces an anomaly when replayed.

## Working with me

- I'm new to Next.js. When you add or change a route, explain in a line or two what it does and how to test it in Postman.
- We're on a ~36-hour clock. Build the weather forecast only after ingestion, stats, anomaly and bill all work.
- `POST /api/readings` is live on Vercel. Until the hardware is ready, `npm run fake-device` (in `energy-monitor/`) stands in for the ESP32; use `-- --watts 2500` to simulate a spike. Real ESP32 integration happens last: keep 4–5 hours for it.
- Ask before adding a new dependency or a new table.
