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
