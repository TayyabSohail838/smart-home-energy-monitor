// Writes 14 days of simulated readings (one every 10 s) for one device, is_seeded = true.
// AC load follows the real hourly Faisalabad temperatures for those days (Open-Meteo),
// so the weather forecast has a real pattern to learn.
// Re-running deletes old seeded rows first (never real readings).
// Usage: npm run seed                 (uses DEVICE_ID from .env.local)
//        npm run seed -- <device_id>
const { createClient } = require("@supabase/supabase-js");

const DAYS = 14;
const STEP_S = 10;
const VOLTAGE = 230;
const BATCH = 1000;
const PARALLEL = 4;
const PKT_OFFSET_H = 5; // Asia/Karachi is UTC+5 all year (no daylight saving)

const deviceId = process.argv[2] || process.env.DEVICE_ID;
const lat = process.env.HOME_LAT;
const lon = process.env.HOME_LON;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Planted spikes for the anomaly list and graphs: days ago, local start hour, minutes, extra watts.
const SPIKES = [
  { daysAgo: 3, hour: 15.25, minutes: 40, extraW: 2600 }, // afternoon: something big left on
  { daysAgo: 7, hour: 3.0, minutes: 35, extraW: 2200 },   // 3 am heater: clear anomaly
  { daysAgo: 11, hour: 11.5, minutes: 45, extraW: 2400 },
];

// Deterministic-ish noise source so re-runs look similar.
let seed = 42;
function rand() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}

// "YYYY-MM-DDTHH:00" in Karachi time, matching Open-Meteo's hourly keys.
function localHourKey(date) {
  const d = new Date(date.getTime() + PKT_OFFSET_H * 3600 * 1000);
  return d.toISOString().slice(0, 13) + ":00";
}

async function fetchTemperatures() {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m&past_days=${DAYS + 1}&forecast_days=1&timezone=Asia%2FKarachi`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const json = await res.json();
  const temps = new Map();
  json.hourly.time.forEach((t, i) => {
    if (json.hourly.temperature_2m[i] != null) temps.set(t, json.hourly.temperature_2m[i]);
  });
  return temps;
}

// Household power (W) at a moment, before noise and spikes.
function basePower(localHour, tempC, isWeekend) {
  let w = 90 + (Math.floor(localHour * 4) % 3 === 0 ? 110 : 0); // fridge compressor cycling

  if (localHour < 6) w += 150;                         // fans at night
  else if (localHour < 9) w += 150 + 350 * Math.sin(((localHour - 6) / 3) * Math.PI); // morning: kettle, iron, lights
  else if (localHour < 17) w += 220;                   // daytime: fans, laptop
  else if (localHour < 18) w += 300;
  else w += 300 + 450 * Math.sin(((localHour - 17) / 7) * Math.PI); // evening peak: lights, TV, iron

  // AC: runs harder the hotter it is, mostly afternoon and night.
  const acHours = (localHour >= 13 && localHour < 17) || localHour >= 21 || localHour < 2;
  if (acHours && tempC > 26) w += Math.min(1500, (tempC - 26) * 180);

  return isWeekend ? w * 1.12 : w;
}

async function main() {
  if (!deviceId) throw new Error("No device id. Set DEVICE_ID in .env.local or pass one.");
  if (!lat || !lon) throw new Error("Set HOME_LAT and HOME_LON in .env.local");

  const { data: device, error: devErr } = await supabase
    .from("devices").select("id, name").eq("id", deviceId).maybeSingle();
  if (devErr || !device) throw new Error(`Device ${deviceId} not found`);

  // Stop where real readings start, so seeded and real data never overlap.
  const now = new Date();
  const start = new Date(now.getTime() - DAYS * 24 * 3600 * 1000);
  const { data: firstReal } = await supabase
    .from("readings").select("ts")
    .eq("device_id", deviceId).eq("is_seeded", false).gte("ts", start.toISOString())
    .order("ts").limit(1).maybeSingle();
  const end = firstReal ? new Date(firstReal.ts) : now;

  console.log(`Device: ${device.name} (${deviceId})`);
  console.log(`Range:  ${start.toISOString()} -> ${end.toISOString()}`);

  console.log("Fetching real Faisalabad temperatures from Open-Meteo...");
  const temps = await fetchTemperatures();
  console.log(`  got ${temps.size} hourly temperatures`);

  console.log("Deleting old seeded rows...");
  const { error: delErr, count: deleted } = await supabase
    .from("readings").delete({ count: "exact" })
    .eq("device_id", deviceId).eq("is_seeded", true);
  if (delErr) throw delErr;
  console.log(`  deleted ${deleted}`);

  const spikeWindows = SPIKES.map((s) => {
    const day = new Date(now.getTime() + PKT_OFFSET_H * 3600 * 1000);
    day.setUTCHours(0, 0, 0, 0);
    const startMs = day.getTime() - s.daysAgo * 86400000 + s.hour * 3600000 - PKT_OFFSET_H * 3600000;
    return { from: startMs, to: startMs + s.minutes * 60000, extraW: s.extraW };
  });

  const rows = [];
  const daily = new Map(); // local date -> { kwh, temps[] }
  let lastTemp = 28;

  for (let t = start.getTime(); t < end.getTime(); t += STEP_S * 1000) {
    const date = new Date(t);
    const local = new Date(t + PKT_OFFSET_H * 3600 * 1000);
    const localHour = local.getUTCHours() + local.getUTCMinutes() / 60;
    const dow = local.getUTCDay();
    const tempC = temps.get(localHourKey(date)) ?? lastTemp;
    lastTemp = tempC;

    let w = basePower(localHour, tempC, dow === 0 || dow === 6);
    w *= 0.93 + rand() * 0.14; // +-7% noise
    for (const s of spikeWindows) if (t >= s.from && t < s.to) w += s.extraW;

    const power_w = Math.round(w * 10) / 10;
    const energy_wh = Math.round(((power_w * STEP_S) / 3600) * 10000) / 10000;
    rows.push({
      device_id: deviceId,
      ts: date.toISOString(),
      current_a: Math.round((power_w / VOLTAGE) * 1000) / 1000,
      power_w,
      energy_wh,
      is_seeded: true,
    });

    const dayKey = local.toISOString().slice(0, 10);
    const d = daily.get(dayKey) ?? { kwh: 0, temps: new Map() };
    d.kwh += energy_wh / 1000;
    d.temps.set(localHourKey(date), tempC); // one temperature per hour
    daily.set(dayKey, d);
  }

  console.log(`Inserting ${rows.length} rows in batches of ${BATCH}...`);
  let done = 0;
  const batches = [];
  for (let i = 0; i < rows.length; i += BATCH) batches.push(rows.slice(i, i + BATCH));
  for (let i = 0; i < batches.length; i += PARALLEL) {
    await Promise.all(
      batches.slice(i, i + PARALLEL).map(async (b) => {
        const { error } = await supabase.from("readings").insert(b);
        if (error) throw error;
        done += b.length;
      })
    );
    process.stdout.write(`\r  ${done}/${rows.length}`);
  }
  console.log("\n\nDaily summary (Karachi dates):");
  for (const [day, d] of daily) {
    const t = [...d.temps.values()];
    const avg = t.reduce((a, b) => a + b, 0) / t.length;
    console.log(`  ${day}  ${d.kwh.toFixed(2).padStart(6)} kWh   avg ${avg.toFixed(1)} °C`);
  }
  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nSeed failed:", err.message);
  process.exit(1);
});
