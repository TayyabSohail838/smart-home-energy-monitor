import { listAlerts } from "@/lib/alerts";
import { getSummary } from "@/lib/bill";
import { getForecast } from "@/lib/forecast";
import { getHistory, getPeakHours, HISTORY_RANGES } from "@/lib/stats";

// Tools the chatbot can call. Each one reads ONLY the logged-in user's device,
// through the user's own Supabase client (RLS applies), and reuses the same
// lib functions as the dashboard, so the bot's numbers match the screens.

export const TOOL_DECLARATIONS = [
  {
    name: "get_live_power",
    description: "Latest readings from the device: current power (W), current (A), mains voltage (V, when the meter reports it), and when the last reading arrived. Use for 'what is my usage right now'.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_summary",
    description:
      "This month so far: today's kWh, month kWh (units), energy-charge bill so far in PKR, current tariff slab, units to next slab, month-end projection (units, bill, slab).",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_usage_history",
    description: "kWh per hour (range=day, today) or per day (week = last 7 days, month = this calendar month, 30d = last 30 days).",
    parameters: {
      type: "object",
      properties: { range: { type: "string", enum: HISTORY_RANGES, description: "Which period" } },
      required: ["range"],
    },
  },
  {
    name: "get_peak_hours",
    description: "Average power for each hour of the day over the last 14 days and the 3 busiest hours.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "get_alerts",
    description: "Recent alerts, newest first: unusual-usage spikes (anomaly) and tariff slab warnings.",
    parameters: {
      type: "object",
      properties: { limit: { type: "integer", description: "How many, 1-20 (default 10)" } },
    },
  },
  {
    name: "get_forecast",
    description:
      "Weather for Faisalabad and predicted electricity use: next 14 days (sky, high/low, rain, predicted kWh) and a month-by-month outlook (temperature, rain, units, bill, estimated AC share), plus the year summary and saving suggestions.",
    parameters: {
      type: "object",
      properties: { months: { type: "integer", description: "How many months ahead, 1-12 (default 3)" } },
    },
  },
];

const round = (n, d = 1) => (n == null ? null : Math.round(n * 10 ** d) / 10 ** d);

async function getLivePower(ctx) {
  const { data, error } = await ctx.supabase
    .from("readings")
    .select("*") // includes voltage_v once supabase/voltage.sql has run
    .eq("device_id", ctx.deviceId)
    .order("ts", { ascending: false })
    .limit(30);
  if (error) throw new Error(error.message);
  if (!data.length) return { note: "No readings yet." };
  const last = data[0];
  const ageS = Math.round((Date.now() - Date.parse(last.ts)) / 1000);
  return {
    last_reading_ts: last.ts,
    seconds_ago: ageS,
    live: ageS < 60,
    power_w: round(last.power_w, 0),
    current_a: round(last.current_a, 2),
    voltage_v: last.voltage_v != null ? round(last.voltage_v, 0) : undefined,
    avg_power_last_5_min_w: round(data.slice(0, 30).reduce((s, r) => s + r.power_w, 0) / data.length, 0),
    note: ageS >= 60 ? "Device is not sending right now; this is the last known reading." : undefined,
  };
}

// Forecast is large; keep only what the bot needs to answer.
function compactForecast(f) {
  if (f.error) return f;
  return {
    model: { formula: f.model.formula, r2: f.model.r2, note: f.model.note },
    this_month: f.this_month,
    next_days: f.next_days.map((d) => ({
      date: d.date, weekday: d.weekday, condition: d.condition,
      high_c: d.temp_max_c, low_c: d.temp_min_c, rain_chance_pct: d.rain_chance_pct, rain_mm: d.rain_mm,
      predicted_kwh: d.predicted_kwh,
    })),
    headline: f.outlook.headline,
    going_down: f.outlook.decreasing,
    going_up: f.outlook.increasing,
    months: f.outlook.months.map((m) => ({
      month: `${m.month} ${m.year}`, season: m.season, temp_c: m.forecast_temp_c, high_c: m.avg_high_c, low_c: m.avg_low_c,
      rain_mm: m.rain_mm, basis: m.weather_basis, units: m.predicted_kwh, ac_units_est: m.ac_kwh_est,
      bill_pkr: m.predicted_bill, slab: m.predicted_slab, change_vs_this_month_pct: m.change_pct,
    })),
    year: f.year && { summary: f.year.summary, weather_basis: f.year.weather_basis },
    suggestions: f.suggestions.map((s) => s.message),
    excludes_taxes: true,
  };
}

const clampInt = (v, min, max, dflt) => (Number.isInteger(v) ? Math.min(max, Math.max(min, v)) : dflt);

// Runs one tool call. ctx = { supabase, deviceId }. Errors come back as { error } so
// the model can explain them instead of the whole chat failing.
export async function runTool(name, args = {}, ctx) {
  try {
    switch (name) {
      case "get_live_power":
        return await getLivePower(ctx);
      case "get_summary":
        return await getSummary(ctx.supabase, ctx.deviceId);
      case "get_usage_history": {
        const range = HISTORY_RANGES.includes(args.range) ? args.range : "week";
        return await getHistory(ctx.supabase, ctx.deviceId, range);
      }
      case "get_peak_hours":
        return await getPeakHours(ctx.supabase, ctx.deviceId);
      case "get_alerts":
        return { alerts: await listAlerts(ctx.supabase, ctx.deviceId, clampInt(args.limit, 1, 20, 10)) };
      case "get_forecast":
        return compactForecast(await getForecast(ctx.supabase, ctx.deviceId, { months: clampInt(args.months, 1, 12, 3) }));
      default:
        return { error: `unknown tool ${name}` };
    }
  } catch (err) {
    console.error(`chat tool ${name} failed:`, err);
    return { error: `could not load data for ${name}` };
  }
}
