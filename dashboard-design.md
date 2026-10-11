# design-dashboard.md: Wattly Dashboard ("Meter Room")

Redesign of the logged-in app for **Wattly**. It continues the bill-paper brand from `design.md` and `design-auth.md`, but the app itself is a **meter room**: the house's heart monitor, analogue gauges, indicator lamps, breaker switches and a logbook.

Not a traditional dashboard: no grid of identical white cards, no standard sidebar.

Reuses the existing API routes, Supabase Realtime and Recharts. One new API route is needed (section 9). No new tables, no new dependencies.

---

## 1. Decisions (locked)

| Decision | Choice |
| --- | --- |
| Style | Meter room: paper page with instrument-style components |
| Overview centrepiece | Live line graph ("heart monitor"), default **24 HRS**, filters **1 HR** and **1 WEEK** |
| Navigation | Breaker-panel switches (left on desktop, bottom bar on mobile) |
| Pages | Overview · Usage · Forecast · Alerts (+ Settings inside Alerts) · Link device |

---

## 2. Tokens

Same paper/ink tokens and fonts as `design.md` (Big Shoulders Display, Martian Mono, Instrument Sans, Noto Nastaliq Urdu). Added for instrument screens and lamps:

```css
:root {
  /* Monitor screen (dark panel inside the paper page) */
  --screen:        #121417;
  --screen-grid:   #26302C;  /* faint green-grey grid */
  --screen-text:   #D9E1DC;
  --trace:         #4C95EA;  /* usage blue, lightened for dark background */
  --trace-glow:    rgba(76, 149, 234, 0.35);

  /* Lamps */
  --lamp-green:    #3FBF6E;
  --lamp-amber:    #F2A93B;
  --lamp-red:      #E5484D;
  --lamp-off:      #3A3D42;

  /* Breakers */
  --breaker-body:  #2A2C30;
  --breaker-on:    #eb6834;  /* active page, AC orange */
  --breaker-off:   #6B6F76;
}
```

Rules:
- The page background stays `--paper`. Only instruments (monitor, lamp panel, breakers) are dark.
- Usage = blue, temperature/AC = orange, warnings = red. Every status uses an icon + text, never colour alone.
- All numbers in Martian Mono with tabular figures.

---

## 3. App shell: breaker panel navigation

### Desktop (≥ 1024px)

A slim vertical panel on the left (~120px), styled like a distribution board (`--breaker-body`, subtle screws in the corners).

```
┌──────────┐
│  WATTLY  │  logo + device name + online dot
│ ● Home-1 │
├──────────┤
│  ▮ ON    │  OVERVIEW   (active: handle up, orange)
│  ▯       │  USAGE
│  ▯       │  FORECAST
│  ▯       │  ALERTS     (red count badge if unread spikes today)
├──────────┤
│  ▯       │  SETTINGS   → /alerts#settings
│  ▯ MAIN  │  LOG OUT    (red handle, like a main breaker)
└──────────┘
```

- Each breaker: a rectangle with a handle. Active = handle **up**, lit `--breaker-on`, label in paper colour. Inactive = handle down, `--breaker-off`.
- Click: the handle flips (rotate/translate, 180 ms, slight overshoot), then navigate.
- Each breaker has a text label + icon. `aria-current="page"` on the active one.
- Log out asks nothing extra; it signs out and goes to `/`.

### Mobile (< 768px)

Bottom bar with the four breakers side by side (same flip style), 56px tall, thumb-friendly. Settings and Log out move into a small menu in the top header (logo + device dot + ⋯).

### Tablet (768–1023px)

Left panel collapses to icons + short labels (~80px).

---

## 4. Overview (`/dashboard`)

Layout, desktop:

```
┌───────────────────────────────────────────┬───────────────┐
│ Good evening · Sun 11 Oct                 │ STATUS LIGHTS │
│                                           │  ● DEVICE     │
│        MAIN MONITOR (4.1)                 │  ● SLAB       │
│        [1 HR | 24 HRS | 1 WEEK]           │  ● SPIKES     │
│                                           │  ● WEATHER    │
├───────────────────────────────────────────┴───────────────┤
│ NOW 1,109 W · PEAK 2,840 W @ 9:12 PM · AVG 640 W · TODAY 9.4 kWh │
├──────────────────────────┬────────────────────────────────┤
│ UNITS COUNTER (4.3)      │ SLAB DIAL + BILL SLIP (4.4)    │
└──────────────────────────┴────────────────────────────────┘
```

Mobile: status lights become a horizontal scrolling row above the monitor; everything else stacks.

A thin red **alert ticker** can slide in across the very top of the page (4.5).

### 4.1 Main monitor (the heart monitor)

- Dark screen panel (`--screen`), 8px radius, inset shadow, a faint grid (`--screen-grid`) every major tick.
- Line: `--trace`, 2px, with a soft glow (`drop-shadow` using `--trace-glow`). Area under the line: very faint blue gradient.
- **Live tip:** a pulsing dot at the end of the line plus a label with current watts (`1,109 W`). On each new Realtime reading the dot moves and the label updates.
- **Filters:** three switch-style buttons above the screen: `1 HR` · `24 HRS` (default) · `1 WEEK`. Active = lit orange. `role="radiogroup"`.

| Filter | Points | Bucket | Live update |
| --- | --- | --- | --- |
| 1 HR | ~360 | raw 10 s readings | append each Realtime reading, drop points older than 1 h |
| 24 HRS | 288 | 5-min average | update the latest bucket's average live; add a new bucket every 5 min |
| 1 WEEK | 168 | 1-hour average | update the latest bucket live |

- **Night shading:** on 24 HRS and 1 WEEK, 10 PM–6 AM (Asia/Karachi) bands are slightly darker.
- **Spike markers:** anomaly alerts in the visible range get a small red ▲ marker on the line with ⚠. Hover/tap shows the alert message and time.
- **Axes:** mono labels in `--screen-text` at low opacity. Y axis in W (switch to kW above 1,000 if the max is large). X axis: times (1 HR, 24 HRS) or weekday names (1 WEEK).
- **Tooltip:** small dark tag: `9:12 PM · 2,840 W`.
- **Empty state:** flat dashed line with text `NO SIGNAL · waiting for first reading`.
- Built with Recharts (`LineChart`/`AreaChart`), animation off for live updates to avoid jitter.

### 4.2 Readouts strip

Printed-style strip under the monitor (paper background, dotted top and bottom rules, mono):

`NOW 1,109 W` · `PEAK 2,840 W @ 9:12 PM` · `AVG 640 W` · `TODAY 9.4 kWh`

- PEAK and AVG follow the active filter's range. TODAY always comes from the summary API.
- Mobile: 2×2 grid.

### 4.3 Units counter

- Rolling mechanical digits, like the odometer on an analogue meter: `0 2 8 7` with the label `UNITS THIS MONTH` and Urdu `یونٹس`.
- Each digit is a separate drum (dark background, paper numbers, slight top/bottom shading). When the value changes, the changed digits roll up (300 ms).
- Below: `PROJECTED 312 units by month end` (mono).
- Value = `month_kwh` rounded down; projection = `projected_month_kwh`.

### 4.4 Slab dial + bill slip

**Slab dial:** half-circle gauge (custom SVG).
- Zones from the tariff slabs, coloured cooler to warmer (blue → orange → red). Zone labels on the arc, like `0–100`, `101–200`, `201–300`, `301+`.
- **Solid needle:** current units (`month_kwh`).
- **Ghost needle:** dotted, projected units (`projected_month_kwh`).
- Under the dial: `13 UNITS TO NEXT SLAB`. When the projected slab is higher than the current one, add ⚠ and `PROJECTED: 301+ SLAB` in red.
- Needles sweep from 0 on first load (600 ms).
- Accessible text: `aria-label="Current 287 units, slab 201–300. Projected 312 units, slab 301 and above."`

**Bill slip:** beside the dial, a small paper slip with a torn/zig-zag bottom edge:

```
BILL SO FAR      Rs 9,840
PROJECTED        Rs 14,820
SLAB MODE        Single rate
Energy charge only, excludes taxes.
```

### 4.5 Status lights panel

Four lamps, each: glowing circle + label + one mono line.

| Lamp | Green | Amber | Red | Source |
| --- | --- | --- | --- | --- |
| DEVICE | "Online, last reading 4 s ago" | no reading for > 1 min | no reading for > 5 min | latest reading `ts` (Realtime) |
| SLAB | "Safe this month" | within 20 units of next slab (projected) | projected slab > current slab | summary API |
| SPIKES | "None today" | — | "1 spike at 9:12 PM" (count if more) → links to Alerts | alerts API (today) |
| WEATHER | mild day | "34°C today, AC load expected" (high ≥ 32°C) | — | forecast `next_days[0]` |

- On state change: the lamp blinks twice (2 × 200 ms), then stays steady. No constant blinking.
- Off/unknown: `--lamp-off` with text `NO DATA`.
- **Alert ticker:** when a new anomaly arrives while the page is open, a thin red strip slides down at the top: `⚠ SPIKE · 2,840 W at 9:12 PM · View`. Auto-hides after 10 s or on close. `role="status"`.

### 4.6 Greeting line

Top-left: `Good evening · Sun 11 Oct` (Big Shoulders, 32px) + device name in mono. Greeting by Asia/Karachi time.

---

## 5. Usage (`/usage`)

### 5.1 History: strip-chart recorder

- Paper roll look: off-white strip with faint graph lines and small "sprocket" holes on the top and bottom edges.
- Bars in ink with a blue top cap, kWh per hour (TODAY) or per day (others).
- Tabs: `TODAY` · `7 DAYS` · `THIS MONTH` · `30 DAYS` (maps to `range=day|week|month|30d`).
- On tab change, the paper "feeds" sideways (slide 250 ms).
- Tooltip as a printed tag: `Thu 8 Oct · 11.2 kWh · ~Rs 520`. Rupee value is an estimate at the current slab rate; label it `~`.
- Toggle `GRAPH | TABLE` (top-right).

### 5.2 Table view: log sheet

Lined paper, mono columns, alternating faint rows:

| DATE / HOUR | kWh | EST. Rs |
| --- | --- | --- |

Sticky header, right-aligned numbers, totals row with a double rule.

### 5.3 Peak hours: 24-hour clock dial

- Round dial (custom SVG): 24 rays from the centre, length = average power for that hour.
- Top 3 hours in orange with labels (`9 PM · 2.1 kW`); others in blue at lower opacity.
- A thin needle points to the current hour.
- Centre text: `PEAK 9 PM`.
- Readout under the dial: `Your home works hardest at 9 PM (avg 2.1 kW). Top hours: 9 PM, 10 PM, 8 PM.`
  - Do **not** claim appliance-level savings (no appliance detection in scope).
- Accessible fallback: a visually hidden list of the 24 hours and their averages.

---

## 6. Forecast (`/forecast`): the weather station

### 6.1 14-day strip

- A horizontal row of 14 instrument tiles (scrolls sideways on mobile, snap scrolling).
- Each tile: weekday + date, weather icon, high/low in orange, rain chance, predicted kWh in blue (big mono).
- Hot days (high ≥ 35°C) get a soft orange glow border + 🔥 label `HOT`.
- Today's tile is outlined in ink.

### 6.2 12-month year tape

- Long horizontal chart: blue bars = predicted kWh per month, orange line = forecast temperature (second axis).
- Bars tinted by predicted slab (lighter for lower slab, deeper for higher).
- `weather_basis` shown honestly:
  - `forecast`: solid bar
  - `mixed`: solid bar with a hatched top
  - `normals`: fully hatched bar + small label `NORMALS`
- Likely range (when present): thin vertical whisker on the temperature point.
- Tooltip: `Dec 2026 · 14°C · 160 kWh · Rs 6,200 · slab 101–200`.
- Months switch: `3 MO` · `6 MO` · `12 MO` (maps to `?months=`).
- Year summary under it (when `year` is present): total kWh, total bill, cheapest and most expensive month, as a mono readout strip.

### 6.3 Outlook board

- Headline from `outlook.headline` in Big Shoulders, 44px.
- Two printed columns: **▼ GOING DOWN** (green) and **▲ GOING UP** (orange), each item = bold item + one line detail.

### 6.4 Advisories

- Each suggestion as a notice card (paper, ink border) with a stamp by type:
  - `ADVISORY` (ink stamp) for general tips
  - `HEAT WARNING` (red stamp) for hot days ahead
  - `STORM` (blue stamp) for thunderstorms
- Max 4 visible; `Show all` expands.

### 6.5 Calibration plate

- Small brushed-metal style plate (CSS gradient), engraved-looking mono text:
  ```
  MODEL      daily_kwh = a + b × CDD
  BASE LOAD  6.2 kWh/day
  PER °C     0.41 kWh
  FIT (R²)   0.78
  ```
- Label: `Weather-driven usage (est.)`. Small screw dots in the corners.
- `422` (fewer than 7 days of data): plate shows `CALIBRATING · needs 7 days of readings` and the page shows only weather, no kWh predictions.

---

## 7. Alerts (`/alerts`): the logbook

### 7.1 Settings panel (top, `id="settings"`)

- **Wall switch:** a big toggle styled like a light switch: `EMAIL ALERTS ON / OFF`. `role="switch"`, `aria-checked`.
- **Alert email** field (mono input) + `SAVE` button.
- On save: green `SAVED` stamp thumps onto the panel. Error: red text with ⚠.
- Uses `GET/PATCH /api/settings`.

### 7.2 Logbook timeline

- Lined paper, a red margin line on the left like a notebook.
- Day dividers: dotted rule + `TODAY` / `YESTERDAY` / `THU 8 OCT`.
- Each entry:
  - Left: time in mono (`9:12 PM`).
  - Middle: message (Instrument Sans).
  - Right: stamp: 🔴 `SPIKE` (type `anomaly`) or 🟠 `SLAB` (type `slab_warning`).
  - Under the message: `✉ SENT` or `NOT SENT` (from `emailed`).
- New alerts arriving while open slide in at the top with a short highlight.
- **Empty state:** green stamp `ALL CLEAR` + "No alerts in the last 30 days."

---

## 8. Link device (`/link`)

- No breaker panel (user has no device yet). Header with Wattly logo only.
- Illustration: back of the Wattly device with its rating plate; an arrow points to the sticker with the link code.
- Heading: **"Connect your meter."** Sub-line: *"Enter the 6-character code printed on your Wattly device."*
- **Code input:** six boxes, big mono characters, uppercase. Typing moves to the next box; Backspace moves back; pasting fills all six. `autocomplete="one-time-code"`, one visible label for the group.
- Button: `CONNECT DEVICE`. Submitting: `Searching for your meter…`.
- Success: green `CONNECTED` stamp → breaker "power on" animation (handle flips up, lamps light in sequence, ~800 ms) → `/dashboard`.
- Errors (red, ⚠):
  - code not found → "That code doesn't match any device."
  - device already linked → "This device is already linked to another account."
  - user already has a device → "Your account already has a device." + link to Overview.

---

## 9. Data sources

| UI | Source |
| --- | --- |
| Monitor (all filters), PEAK, AVG | **New:** `GET /api/stats/live?range=1h|24h|week` |
| Live tip, DEVICE lamp | Supabase Realtime on `readings` inserts (existing) |
| TODAY, units counter, slab dial, bill slip, SLAB lamp | `GET /api/stats/summary` |
| Slab dial zones | tariff slabs (add `slabs: [{ min_units, max_units }]` to the summary response) |
| Spike markers, SPIKES lamp, ticker, logbook | `GET /api/alerts` (+ Realtime on `alerts` inserts if easy; otherwise refetch every 60 s) |
| WEATHER lamp, Forecast page | `GET /api/forecast` |
| Usage history | `GET /api/stats/history` |
| Peak hours dial | `GET /api/stats/peak-hours` |
| Settings | `GET/PATCH /api/settings` |

### New route: `GET /api/stats/live?range=1h|24h|week`

- Returns `{ range, bucket_seconds, points: [{ ts, power_w }], peak: { power_w, ts }, avg_power_w }`.
- `1h`: raw readings (bucket 10 s). `24h`: 5-minute average of `power_w`. `week`: 1-hour average.
- Rolling windows (now − 1 h / 24 h / 7 d), not calendar days.
- Aggregate in SQL (`date_bin` in a Postgres function, like `usage_history`), not in JS.
- Same auth rules as other user routes: session required (`401`), own device only, `400` for a bad range.

---

## 10. Motion

- CSS-only animations (no animation library).
- Breaker flip 180 ms · lamp blink 2 × 200 ms · digit roll 300 ms · needle sweep 600 ms · stamp thump 250 ms · ticker slide 250 ms · strip-chart feed 250 ms.
- Live chart: no Recharts animation on updates; only the tip dot pulses (1.6 s loop, the one allowed loop).
- `prefers-reduced-motion: reduce` → no pulse, no blink, no sweep; values appear instantly.

---

## 11. Responsive summary

| Part | Mobile (< 768px) |
| --- | --- |
| Navigation | Bottom bar of 4 breakers; settings/log out in header menu |
| Status lights | Horizontal scroll row above the monitor |
| Monitor | Full width, 260px tall (desktop ~380px); filters full-width segmented |
| Readouts | 2×2 grid |
| Units counter + dial | Stacked |
| 14-day strip | Horizontal snap scroll |
| Year tape | Horizontal scroll inside its card |
| Peak dial | Full width, labels only for top 3 |

16px side gutters, no horizontal page scroll.

---

## 12. Implementation notes

- Routes after the landing page change:
  ```
  app/(dashboard)/layout.js            # breaker-panel shell
  app/(dashboard)/dashboard/page.js    # Overview (moved from "/")
  app/(dashboard)/usage/page.js
  app/(dashboard)/forecast/page.js
  app/(dashboard)/alerts/page.js
  app/link/page.js
  app/api/stats/live/route.js          # new
  ```
- Suggested components:
  ```
  components/meter/BreakerNav.js
  components/meter/Monitor.js          # client: Recharts + Realtime + filters
  components/meter/Readouts.js
  components/meter/StatusLights.js
  components/meter/AlertTicker.js
  components/meter/UnitsCounter.js     # rolling digits
  components/meter/SlabDial.js         # SVG gauge, two needles
  components/meter/BillSlip.js
  components/meter/StripChart.js
  components/meter/PeakClock.js        # SVG 24-hour dial
  components/meter/DayTiles.js
  components/meter/YearTape.js
  components/meter/CalibrationPlate.js
  components/meter/Logbook.js
  components/meter/WallSwitch.js
  components/meter/CodeInput.js
  components/auth/Stamp.js             # shared with landing + auth
  ```
- Keep `lib/useApi.js` behaviour: `401` → `/login`, no device → `/link`.
- Times displayed in Asia/Karachi; stored in UTC.
- Before demo: `npm run seed`, then screenshot the Overview for the landing page preview.