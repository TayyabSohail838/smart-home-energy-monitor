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
node scripts/seed.js # writes 14 days of sample readings (see Seed data)
```

## Folder structure

```
app/
  api/
    readings/route.js        # POST  - ESP32 ingestion (device key auth)
    devices/link/route.js    # POST  - link device to logged-in user
    stats/summary/route.js   # GET   - today/month kWh, bill, slab info
    stats/history/route.js   # GET   - ?range=day|week|month
    stats/peak-hours/route.js# GET   - avg power per hour + top 3
    alerts/route.js          # GET   - user's alerts, newest first
    forecast/route.js        # GET   - predicted kWh/bill + suggestions
lib/
  supabase/server.js         # cookie-based client for user requests
  supabase/admin.js          # service-role client (server only)
  deviceAuth.js              # hash + verify x-device-key
  anomaly.js                 # anomaly rule
  bill.js                    # slab pricing + month-end projection
  alerts.js                  # create alert row + send email
  email.js                   # Resend wrapper
  weather.js                 # Open-Meteo forecast + monthly climate average
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

Tariff rates are not hard-coded anywhere. They live in `tariff_slabs` and are filled from the current residential tariff on a real bill.

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

Returns `{ today_kwh, month_kwh, bill_so_far, current_slab, units_to_next_slab, projected_month_kwh, projected_slab }`.

### `GET /api/stats/history?range=day|week|month`

- `day`: kWh per hour for today. `week` / `month`: kWh per day.
- Sum `energy_wh / 1000`; don't integrate power again.

### `GET /api/stats/peak-hours`

Returns 24 items `{ hour, avg_power_w }` plus `top_hours` (the 3 highest).

### `GET /api/alerts`

User's alerts, newest first, limit 50.

### `GET /api/forecast`

Returns `{ next_days: [{ date, temp_c, predicted_kwh }], next_month: { month, avg_temp_c, predicted_kwh, predicted_bill, change_pct }, weather_share_kwh, suggestions: [{ type, message }], excludes_taxes: true }`.

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
2. Price it with `tariff_slabs`. Keep the pricing function in `lib/bill.js` and make the slab calculation mode a single, clearly named option, since tariff rules change.
3. Projection = month kWh ÷ days passed × days in month.
4. Slab warning when the projection crosses into a higher slab. At most once per slab per month.
5. Energy charge only. Taxes, fuel adjustment and fixed charges are excluded, and the API response should say so (`excludes_taxes: true`).

**Usage forecast (weather-based):**
1. Weather comes from Open-Meteo (free, no API key, plain `fetch`, cached ~1 hour). Next 7 days: forecast API. Past days: archive API. Next month: average temperature for that month over the last 5 years (a real month-ahead weather forecast doesn't exist; call it a climate average).
2. Cooling degrees `CDD = max(0, daily avg temp − 24°C)`.
3. Fit `daily_kwh = a + b × CDD` with simple linear regression on the user's past days (plain JS, no library). `a` = base load, `b` = extra kWh per degree of heat (mostly AC).
4. Predict next days and next month with the same formula; price next month with `lib/bill.js`.
5. Suggestions are fixed if/then rules with templates (no LLM): usage rising → shift iron/washing machine out of peak hours, AC at 26°C; usage falling → expected saving in PKR; projection enters a higher slab → units per day to save.
6. The weather-driven part (`b × CDD`) is an estimate, not measured AC use. Label it "weather-driven usage (est.)" in the API and UI.

**Alerts:** insert into `alerts`, then email via Resend if `user_settings.email_alerts` is on. Set `emailed = true` on success. Email failure is logged, never thrown.

## Security rules

- The service-role key is used only in `lib/supabase/admin.js` and only from route handlers. It must never be imported into client components.
- Store only the SHA-256 hash of device keys. Compare with a constant-time check.
- RLS on: users can `select` only rows whose device belongs to them. No client-side inserts into `readings` or `alerts`.
- Validate every request body (types, ranges: `current_a >= 0`, `power_w >= 0`, `ts` within the last day and not in the future).

## Seed data

`scripts/seed.js` writes 14 days of readings at 10 s intervals for one demo device, `is_seeded = true`:
- Night low (fridge, fans), a morning bump, an evening peak (lights, AC, iron, TV).
- Small random noise; weekends slightly higher.
- AC load follows the real daily temperatures for those 14 days (Open-Meteo archive), so the forecast regression has a real pattern to learn.
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
