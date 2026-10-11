export const HISTORY_RANGES = ["day", "week", "month", "30d"];
export const LIVE_RANGES = ["1h", "24h", "week"];
const LIVE_BUCKET_SECONDS = { "1h": 10, "24h": 300, week: 3600 };

// kWh per hour (range=day) or per day (week, month, 30d), in Karachi time.
// The grouping runs in Postgres (supabase/stats.sql), so we never pull raw rows.
export async function getHistory(supabase, deviceId, range) {
  const { data, error } = await supabase.rpc("usage_history", {
    p_device_id: deviceId,
    p_range: range,
  });
  if (error) throw new Error(`usage_history: ${error.message}`);

  const points = data.map((row) => ({
    bucket: row.bucket,
    kwh: row.kwh === null ? null : Number(row.kwh),
  }));
  const total_kwh = points.reduce((sum, p) => sum + (p.kwh ?? 0), 0);

  return {
    range,
    unit: range === "day" ? "hour" : "day",
    total_kwh: Math.round(total_kwh * 1000) / 1000,
    points,
  };
}

// Points for the Overview monitor (dashboard-design.md §4.1): a rolling window,
// bucketed and aggregated in Postgres (supabase/stats.sql), not pulled raw into JS.
export async function getLiveStats(supabase, deviceId, range) {
  const { data, error } = await supabase.rpc("stats_live", {
    p_device_id: deviceId,
    p_range: range,
  });
  if (error) throw new Error(`stats_live: ${error.message}`);

  const points = data
    .filter((row) => row.avg_power_w !== null)
    .map((row) => ({ ts: row.bucket_ts, power_w: Number(row.avg_power_w) }));

  // Peak and the window average are the same on every row (computed once in SQL);
  // null only when the window has no readings at all.
  const first = data[0];
  const peak = first?.peak_power_w != null ? { power_w: Number(first.peak_power_w), ts: first.peak_ts } : null;
  const avg_power_w = first?.window_avg_power_w != null ? Number(first.window_avg_power_w) : null;

  return {
    range,
    bucket_seconds: LIVE_BUCKET_SECONDS[range],
    points,
    peak,
    avg_power_w,
  };
}

export const PEAK_DAYS = 14;

// Mean and standard deviation of power for each hour of the day (0-23, Karachi time).
// Used by peak hours here and by the anomaly check.
export async function getHourlyProfile(supabase, deviceId, days = PEAK_DAYS) {
  const { data, error } = await supabase.rpc("hourly_profile", {
    p_device_id: deviceId,
    p_days: days,
  });
  if (error) throw new Error(`hourly_profile: ${error.message}`);

  return data.map((row) => ({
    hour: row.hour,
    avg_power_w: Number(row.avg_power_w),
    stddev_power_w: Number(row.stddev_power_w),
    samples: Number(row.samples),
  }));
}

// 0 -> "12 am", 13 -> "1 pm", 24 -> "12 am"
function hourLabel(h) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h % 24 < 12 ? "am" : "pm"}`;
}

// "between 7 pm and 10 pm" when the top hours are back to back, else "around 2 pm, 3 pm and 9 pm".
// A back-to-back block can wrap past midnight (10 pm, 11 pm, 12 am), so test every
// hour in the set as a possible start of a run mod 24, not just the lowest number.
function peakPhrase(topHours) {
  const sorted = [...topHours].sort((a, b) => a - b);
  const hours = new Set(sorted);
  const start = sorted.find((h) => !hours.has((h + 23) % 24));
  if (start != null && sorted.every((_, i) => hours.has((start + i) % 24))) {
    return `between ${hourLabel(start)} and ${hourLabel((start + sorted.length) % 24)}`;
  }
  const labels = sorted.map(hourLabel);
  return `around ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

// Average power per hour of day over the last 14 days, and the 3 highest hours.
export async function getPeakHours(supabase, deviceId) {
  const profile = await getHourlyProfile(supabase, deviceId);
  // `samples` goes out too: hours with no readings average 0 and must not be
  // ranked as if they were measured.
  const hours = profile.map(({ hour, avg_power_w, samples }) => ({ hour, avg_power_w, samples }));

  const withData = profile.filter((p) => p.samples > 0);
  if (withData.length === 0) {
    return { days: PEAK_DAYS, hours, top_hours: [], message: "Not enough data yet." };
  }

  const top_hours = [...withData]
    .sort((a, b) => b.avg_power_w - a.avg_power_w)
    .slice(0, 3)
    .map((p) => p.hour);

  return {
    days: PEAK_DAYS,
    hours,
    top_hours,
    message:
      `Most of your usage is ${peakPhrase(top_hours)}. ` +
      "Run the iron or washing machine outside these hours.",
  };
}

// Mains voltage for the Overview's voltage chart: avg and max per bucket over the same
// rolling windows as the live monitor (supabase/voltage.sql). Readings without a
// voltage (older firmware, seed data) are skipped, so an empty list means "no voltage yet".
export async function getVoltageStats(supabase, deviceId, range) {
  const { data, error } = await supabase.rpc("voltage_live", { p_device_id: deviceId, p_range: range });
  if (error) throw new Error(`voltage_live: ${error.message}`);

  const first = data[0];
  return {
    range,
    bucket_seconds: LIVE_BUCKET_SECONDS[range],
    points: data.map((row) => ({
      ts: row.bucket_ts,
      avg_voltage_v: Number(row.avg_voltage_v),
      max_voltage_v: Number(row.max_voltage_v),
    })),
    latest: first ? { voltage_v: Number(first.latest_voltage_v), ts: first.latest_ts } : null,
    max_voltage_v: first ? Number(first.window_max_voltage_v) : null,
  };
}
