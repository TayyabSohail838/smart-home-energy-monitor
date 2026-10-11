import { createAlert, hasRecentAlert } from "@/lib/alerts";
import { getHourlyProfile, PEAK_DAYS } from "@/lib/stats";
import { supabaseAdmin } from "@/lib/supabase/admin";

const WINDOW_MIN = 5;          // average the latest 5 minutes
const MIN_RECENT_READINGS = 6; // need at least 1 minute of data in that window
const SIGMA_K = 3;             // avg > mu + 3 sigma
const MIN_EXCESS_W = 300;      // and avg - mu > 300 W (stops false alarms when sigma is tiny)
const COOLDOWN_MIN = 30;       // at most one anomaly alert per 30 minutes
const MIN_BASELINE_SAMPLES = 360; // at least 1 hour of history for this hour of day
const BASELINE_TTL_MS = 10 * 60 * 1000;
const PKT_OFFSET_MS = 5 * 3600 * 1000;

// Baselines change slowly, so cache them per device + hour for 10 minutes
// (readings arrive every 10 s; no need to scan 14 days each time).
const baselineCache = new Map();

async function baselineFor(deviceId, hour) {
  const key = `${deviceId}:${hour}`;
  const hit = baselineCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const profile = await getHourlyProfile(supabaseAdmin, deviceId, PEAK_DAYS);
  const value = profile.find((p) => p.hour === hour);
  baselineCache.set(key, { value, expires: Date.now() + BASELINE_TTL_MS });
  return value;
}

function hourLabel(h) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h < 12 ? "am" : "pm"}`;
}

// Runs after each insert. Creates an anomaly alert when the last 5 minutes are far
// above what this home normally uses at this hour of the day.
// Returns what it decided, for logs and tests.
export async function checkAnomaly(deviceId, now = new Date()) {
  const since = (min) => new Date(now.getTime() - min * 60000).toISOString();

  if (await hasRecentAlert(deviceId, "anomaly", since(COOLDOWN_MIN))) {
    return { anomaly: false, reason: "cooldown" };
  }

  const { data: recent, error } = await supabaseAdmin
    .from("readings")
    .select("power_w")
    .eq("device_id", deviceId)
    .gte("ts", since(WINDOW_MIN))
    .lte("ts", now.toISOString());
  if (error) throw new Error(`recent readings: ${error.message}`);
  if (recent.length < MIN_RECENT_READINGS) return { anomaly: false, reason: "not enough recent data" };

  const avg = recent.reduce((sum, r) => sum + r.power_w, 0) / recent.length;
  const hour = new Date(now.getTime() + PKT_OFFSET_MS).getUTCHours();
  const base = await baselineFor(deviceId, hour);
  if (!base || base.samples < MIN_BASELINE_SAMPLES) return { anomaly: false, reason: "no baseline yet" };

  const mu = base.avg_power_w;
  const sigma = base.stddev_power_w;
  const result = { avg_w: Math.round(avg), mu_w: mu, sigma_w: sigma, hour };

  if (!(avg > mu + SIGMA_K * sigma && avg - mu > MIN_EXCESS_W)) {
    return { anomaly: false, reason: "normal", ...result };
  }

  const times = mu > 0 ? avg / mu : null;
  const message =
    `Usage is ${Math.round(avg).toLocaleString("en-US")} W` +
    (times ? `, about ${times.toFixed(1)}× normal for ${hourLabel(hour)}` : ` at ${hourLabel(hour)}`) +
    `. Check if something was left on.`;

  const alert = await createAlert({ deviceId, type: "anomaly", message, powerW: Math.round(avg) });
  return { anomaly: true, alert_id: alert.id, message, ...result };
}
