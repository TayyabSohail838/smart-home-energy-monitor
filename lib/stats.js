export const HISTORY_RANGES = ["day", "week", "month", "30d"];

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
function peakPhrase(topHours) {
  const sorted = [...topHours].sort((a, b) => a - b);
  const backToBack = sorted.every((h, i) => i === 0 || h === sorted[i - 1] + 1);
  if (backToBack) return `between ${hourLabel(sorted[0])} and ${hourLabel(sorted.at(-1) + 1)}`;
  const labels = sorted.map(hourLabel);
  return `around ${labels.slice(0, -1).join(", ")} and ${labels.at(-1)}`;
}

// Average power per hour of day over the last 14 days, and the 3 highest hours.
export async function getPeakHours(supabase, deviceId) {
  const profile = await getHourlyProfile(supabase, deviceId);
  const hours = profile.map(({ hour, avg_power_w }) => ({ hour, avg_power_w }));

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
