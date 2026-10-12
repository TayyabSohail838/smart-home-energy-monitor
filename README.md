# Wattly: Smart Home Energy Monitor

**Know your bill before it knows you.**

Wattly is a small device that clips onto your home's main electricity wire. A web dashboard then shows you, live, how much electricity you are using and what your bill will be.

🔗 **Live app:** https://smart-home-energy-monitor-bay.vercel.app

---

## The problem

In Pakistan, the electricity bill uses **slabs**. If you cross a slab limit by even one unit, every unit can be charged at the higher rate. For example, going from 199 units to 201 units can make the whole bill thousands of rupees more expensive.

Most people only find this out when the paper bill arrives, and by then it is too late to do anything about it.

## What Wattly does

| Feature | What it means for you |
| --- | --- |
| ⚡ **Live dashboard** | See how much power your home is using right now, updated every few seconds. Check it from your phone, anytime and anywhere. |
| 🧾 **Bill so far + month-end estimate** | See this month's units, the bill so far, your current slab, and what the bill will be at the end of the month at your current pace. |
| 📧 **Slab alerts by email** | Get an email whenever only **10 units are left** before the next, more expensive slab: at 90, 190, 290 units and so on. The email says how much the bill will jump if you cross. You also get a warning if your month-end estimate is heading into a higher slab. |
| 🚨 **Unusual usage alerts** | If your home suddenly uses much more power than normal for that time of day (a heater left on, a faulty appliance), you get an alert. |
| 🔌 **High-voltage alerts** | If mains voltage goes above 250 V, you get an email so you can switch off sensitive appliances before they are damaged. |
| 🕒 **Peak hours** | See which hours of the day use the most electricity, so you know when to run heavy appliances less. |
| 🌤️ **Weather forecast + bill outlook** | Wattly learns how hot weather affects your usage (mostly AC). It then uses the weather forecast to predict the next 14 days and the next 12 months, with money-saving tips. |
| 🤖 **AI chatbot** | Ask questions about your own usage in English, Urdu or Roman Urdu, for example "Is mahine bill kitna aayega?". Answers come from your real data. |

> Bill amounts are the **energy charge only**. Taxes, fuel adjustment and fixed charges are not included.

---

## How it works

```
 Main wire ──► CT clamp ──► PZEM-004T meter ──► ESP32 (Wi-Fi)
                                                    │  every 10 s
                                                    ▼
                                    POST /api/readings  (Next.js on Vercel)
                                                    │
                                ┌───────────────────┼───────────────────┐
                                ▼                   ▼                   ▼
                       Supabase database      Alert checks         Email (Resend)
                       (readings, alerts)   (slab, anomaly,
                                │             voltage)
                                ▼
                       Dashboard (live updates via Supabase Realtime)
```

1. The **CT clamp** goes around the main wire. It measures current without cutting any wires.
2. The **PZEM-004T** meter turns that into current, power, energy and voltage.
3. The **ESP32** reads the meter every 10 seconds and sends the reading to the backend over Wi-Fi. If the Wi-Fi drops, it saves the readings and sends them all when it reconnects.
4. The **backend** checks the device key, saves the reading, and runs the alert checks.
5. The **dashboard** updates live as new readings arrive.

---

## Tech stack

| Part | What we used |
| --- | --- |
| Hardware | ESP32 + PZEM-004T v3.0 + 100 A split-core CT clamp |
| Web app + API | Next.js (App Router), JavaScript |
| Database + login | Supabase (Postgres, Auth, Realtime) |
| Charts | Recharts |
| Styling | Tailwind CSS v4 |
| Email | Resend |
| Weather | Open-Meteo (free, no API key) |
| AI chatbot | Google Gemini |
| Hosting | Vercel |

There is no machine-learning model. The analytics are simple statistics: averages, standard deviation and a straight-line fit. They are easy to check and easy to explain.

---

## Run it on your computer

### 1. What you need

- **Node.js** 20 or newer
- A free **Supabase** project (https://supabase.com)
- *(Optional)* a **Resend** account for alert emails, and a **Gemini** API key for the chatbot

### 2. Install

```bash
git clone https://github.com/TayyabSohail838/smart-home-energy-monitor.git
cd smart-home-energy-monitor
npm install
```

> **Windows note:** the `npm run …` scripts call `node` directly because the `&` in the folder name (`Inovix & Co`) breaks the normal Windows shortcuts. Keep using `npm run …` and it will work.

### 3. Set up the database

Open your Supabase project, go to **SQL Editor**, and run these files **in this order**:

1. `supabase/schema.sql`: tables, security rules (RLS) and live updates
2. `supabase/stats.sql`: functions for history and peak hours
3. `supabase/tariff.sql`: electricity slab rates (NEPRA SRO 279(I)/2026)
4. `supabase/voltage.sql`: voltage column and voltage chart function
5. `supabase/source.sql`: tags each reading as real or test data

All of them are safe to run again.

### 4. Add your keys

Create a file called `.env.local` in the project folder:

```env
# Supabase (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=        # secret: server only, never share it

# Alert emails (Resend)
RESEND_API_KEY=
ALERT_FROM_EMAIL=onboarding@resend.dev

# Home location for the weather forecast (Faisalabad)
HOME_LAT=31.4504
HOME_LON=73.1350

# AI chatbot (https://aistudio.google.com)
GEMINI_API_KEY=
GEMINI_MODEL=gemini-3.8-flash

# Filled in by the steps below
DEVICE_ID=
DEVICE_SECRET=
TEST_EMAIL=
TEST_PASSWORD=
```

Never commit `.env.local`; it is already git-ignored.

### 5. Create a device

```bash
npm run create-device -- "My home"
```

This prints three things **once**:

- **Device ID** and **device secret**: put them in `.env.local` (`DEVICE_ID`, `DEVICE_SECRET`) and in the ESP32 firmware.
- **Link code** (6 letters): you type this on the dashboard to connect the device to your account.

The database only stores a hash of the secret, so save it somewhere safe.

### 6. Start the app

```bash
npm run dev
```

Open http://localhost:3000. Then:

1. Sign up with an email and password.
2. Enter the device's link code.
3. You are on the dashboard.

### 7. Add sample data (optional but recommended)

```bash
npm run seed
```

This writes **30 days** of realistic sample readings. They include low use at night, an evening peak, AC use that follows the real temperatures for those days, and a few planted spikes. Charts, peak hours, the bill and the forecast then have data to show straight away.

Running it again replaces the old sample data. It never touches real readings.

---

## Test without the hardware

You don't need the ESP32 to try everything. The **fake device** script sends a reading every 10 seconds, just like the real one:

```bash
npm run fake-device                    # normal home, about 300 W
npm run fake-device -- --watts 2500    # sudden big load → anomaly alert
npm run fake-device -- --volts 262     # high mains voltage → voltage alert
npm run fake-device -- --url https://smart-home-energy-monitor-bay.vercel.app --once
```

Fake readings are labelled **⚠ SIMULATED** on the dashboard, so they are never confused with real data.

### Live demo with real data (laptop meter)

`scripts/laptop-meter.ps1` reads your **laptop's real power use** from its battery sensor and sends it to the ESP32 over USB. The ESP32 then posts it over its own Wi-Fi like a normal reading. This is a safe, real, changing load for a demo, without touching mains wiring.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/laptop-meter.ps1
```

- Unplug the laptop charger, because the battery sensor only measures while running on battery.
- Close the Arduino Serial Monitor first.
- The dashboard shows **✓ REAL · LAPTOP SENSOR**.

### Calling the API yourself

```bash
npm run get-token -- you@example.com yourpassword     # prints a login token for Postman (Bearer Token)
npm run api /api/stats/summary                        # calls a route as TEST_EMAIL and prints the result
```

---

## The hardware

**Parts:** ESP32 dev board, PZEM-004T v3.0 (with a 100 A split-core CT clamp), jumper wires, USB cable.

**Wiring (PZEM low-voltage side → ESP32):**

| PZEM pin | ESP32 pin |
| --- | --- |
| 5V | 3V3 (keeps the signal at a safe 3.3 V for the ESP32) |
| GND | GND |
| TX | GPIO16 |
| RX | GPIO17 |

> ⚠️ **Mains safety:** the PZEM's L/N terminals connect to 230 V mains. **Only a qualified electrician should do that part.** The CT clamp itself just clips around the live wire and needs no cutting.

**Firmware** (`firmware/wattly-esp32/`):

1. In the Arduino IDE, install the ESP32 board package and the **PZEM004Tv30** library.
2. Copy `secrets.example.h` to `secrets.h` and fill in your Wi-Fi name and password, `DEVICE_ID`, `DEVICE_SECRET` and `API_URL`. The `secrets.h` file is git-ignored.
3. Upload `wattly-esp32.ino`.

**Test switches** at the top of the `.ino` file:

- `TEST_VOLTAGE true` sends a labelled test voltage (225–235 V) while the meter isn't connected to mains. Set it to `false` once an electrician has wired L/N.
- `TEST_POWER` sends made-up watts. It is normally `false`.

The dashboard shows where each reading came from: **✓ REAL · PZEM METER**, **✓ REAL · LAPTOP SENSOR**, **⚠ TEST SIGNAL** or **⚠ SIMULATED**.

---

## How the smart parts work (in plain words)

**Bill estimate**
- Adds up this month's units (kWh) and prices them with the slab rates in the `tariff_slabs` table.
- By default every unit is charged at the rate of the slab your total falls in, which is how "unprotected" bills work.
- Month-end estimate = units so far ÷ days passed × days in the month.

**Slab alerts**
- One email when your projected total is heading into a higher slab.
- Another email when you are within 10 units of a slab's limit, telling you how much the bill jumps at the next unit.
- Each one is sent at most once per slab per month.

**Unusual usage (anomaly)**
- For the current hour of the day, Wattly looks at your last 14 days and works out what is normal (the average and how much it usually varies).
- If the last 5 minutes are far above normal (more than 3× the usual variation **and** at least 300 W more), it sends an alert.
- At most one alert every 30 minutes.

**High voltage**
- Any reading above **250 V** sends an alert (Pakistani mains is normally 230 V).
- The alert gives advice: switch off sensitive appliances, use a stabilizer, report it to FESCO.
- At most one alert every 30 minutes.

**Peak hours**
- Average power for each hour of the day over the last 14 days, in Pakistan time.
- The top 3 hours are highlighted.

**Weather forecast**
- Hot days mean more AC. Wattly fits a straight line, **daily units = base load + extra units × how hot it was**, to your own past days.
- It then applies that line to the weather forecast: 14 days ahead from Open-Meteo, and up to 12 months ahead from a seasonal forecast and past-year averages.
- The AC part is labelled **"weather-driven usage (est.)"** because it is an estimate, not measured AC use.
- The money-saving tips come from simple fixed rules.

**AI chatbot**
- Gemini answers your questions using tools that read **only your own device's data**, the same numbers the dashboard shows.
- It doesn't make up numbers, it replies in your language, and it stays on topic.
- Limited to 30 messages per hour.

---

## API routes

| Method | Route | What it does |
| --- | --- | --- |
| POST | `/api/readings` | The ESP32 sends readings here (one reading or a batch). Needs the `x-device-key` header. |
| POST | `/api/devices/link` | Links a device to the logged-in user with its link code. |
| GET | `/api/stats/live` | Latest reading and where it came from. |
| GET | `/api/stats/summary` | Today's and this month's units, bill so far, slab, month-end estimate. |
| GET | `/api/stats/history?range=day\|week\|month\|30d` | Units per hour (day) or per day. |
| GET | `/api/stats/peak-hours` | Average power for each of the 24 hours + the top 3. |
| GET | `/api/stats/voltage?range=1h\|24h\|week` | Voltage over time + latest value. |
| GET | `/api/alerts` | Your latest 50 alerts. |
| GET / PATCH | `/api/settings` | Turn email alerts on/off, change the alert email. |
| GET | `/api/forecast?months=1-12` | 14-day weather + usage forecast, monthly bill outlook, tips. |
| GET | `/api/suggestions` | Three AI tips for the Overview page. |
| POST | `/api/chat` | The AI chatbot. |
| GET | `/api/health` | Quick "is the server up?" check. |

All user routes need you to be logged in (otherwise `401`), and they only ever read **your own** device.

Example reading for Postman (`POST /api/readings`, header `x-device-key: <device secret>`):

```json
{
  "device_id": "<your device id>",
  "ts": "2026-10-12T14:05:10Z",
  "current_a": 4.82,
  "power_w": 1109,
  "energy_wh": 3.08,
  "voltage_v": 231.4,
  "source": "pzem"
}
```

---

## Security

- The device secret is never stored, only its SHA-256 hash, compared in constant time.
- The Supabase service-role key is used only on the server, never in the browser.
- Row Level Security (RLS) means each user can only read their own device's readings and alerts.
- Every incoming reading is checked: no negative values, and the time must be within the last day and not in the future.

---

## Folder guide

```
app/
  page.js                 landing page
  login/, reset-password/ sign in, sign up, forgot password
  link/                   enter your device's link code
  (dashboard)/            Overview, Usage, Forecast, Alerts, Settings pages
  api/                    all backend routes (see the table above)
components/               dashboard and landing page pieces (charts, live panel, slab meter…)
lib/                      the actual logic: bill, anomaly, voltage, alerts, email, weather, forecast, chat
supabase/                 SQL to set up the database
scripts/                  seed data, fake device, laptop meter, create device, test helpers
firmware/wattly-esp32/    ESP32 code
```

---

## Deploying to Vercel

1. Import this GitHub repo in Vercel. It detects Next.js by itself.
2. Add the same environment variables as in `.env.local`. You don't need `DEVICE_ID`, `DEVICE_SECRET`, `TEST_EMAIL` or `TEST_PASSWORD`, which are only for local scripts.
3. Deploy, then point the ESP32's `API_URL` at `https://<your-app>.vercel.app/api/readings`.

> **Email note:** without your own verified domain in Resend, emails from `onboarding@resend.dev` only reach the email address of the Resend account owner.

---

## What's next (roadmap)

- Load-shedding (power outage) prediction from gaps in the readings
- Detecting which appliance is running (NILM)
- More than one device per home

---

Built in 36 hours for the **Qubitt Hackathon** by **Inovix & Co**.
