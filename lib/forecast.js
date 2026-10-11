import { getSlabs, getSummary, priceUnits, slabFor } from "@/lib/bill";
import { getHistory } from "@/lib/stats";
import { getDailyTemps, getMonthClimate } from "@/lib/weather";

// Weather-based usage forecast. One straight line, fitted on the user's own days:
//   daily_kwh = a + b × CDD,   CDD = max(0, daily mean temperature − 24 °C)
// a = base load (fridge, fans, lights), b = extra kWh per degree of heat (mostly AC).

const BASE_TEMP_C = 24;
const MIN_TRAINING_DAYS = 7;
const CHANGE_THRESHOLD_PCT = 10;   // "rising" / "falling" suggestions
const HOT_DAY_C = 30;
const MAX_SAVE_PER_DAY_KWH = 3;    // suggest staying in a lower slab only if it's realistic
const PKT_OFFSET_MS = 5 * 3600 * 1000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const cdd = (t) => Math.max(0, t - BASE_TEMP_C);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const rs = (n) => `Rs ${Math.round(n).toLocaleString("en-US")}`;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const slabName = (s) => (s.max_units === null ? `${s.min_units}+` : `${s.min_units}-${s.max_units}`);

// Least-squares line y = a + b·x. b is kept >= 0 (heat never lowers AC use).
export function fitLine(points) {
  const mx = mean(points.map((p) => p.x));
  const my = mean(points.map((p) => p.y));
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  const sxy = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const b = sxx > 0 ? Math.max(0, sxy / sxx) : 0;
  const a = my - b * mx;

  const ssTot = points.reduce((s, p) => s + (p.y - my) ** 2, 0);
  const ssRes = points.reduce((s, p) => s + (p.y - (a + b * p.x)) ** 2, 0);
  return { a, b, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

function karachiToday(now) {
  return new Date(now.getTime() + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

function nextMonthOf(now) {
  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = local.getUTCMonth() + 1; // 1-12, this month
  const month = m === 12 ? 1 : m + 1;
  const year = m === 12 ? y + 1 : y;
  return { month, year, days: new Date(Date.UTC(year, month, 0)).getUTCDate() };
}

function buildSuggestions({ thisMonth, nextMonth, nextDays, slabs }) {
  const out = [];
  const change = nextMonth.change_pct;

  if (change >= CHANGE_THRESHOLD_PCT) {
    out.push({
      type: "rising",
      message:
        `${nextMonth.month} looks hotter, so AC use will rise: about ${round(change, 0)}% more units ` +
        `(${Math.round(nextMonth.predicted_kwh)} vs ${Math.round(thisMonth.projected_kwh)}). ` +
        `Set the AC to 26 °C and run the iron and washing machine outside peak hours.`,
    });
  } else if (change <= -CHANGE_THRESHOLD_PCT) {
    out.push({
      type: "falling",
      message:
        `${nextMonth.month} is usually cooler, so the AC will run less: about ${round(-change, 0)}% fewer units ` +
        `and roughly ${rs(thisMonth.projected_bill - nextMonth.predicted_bill)} less on the energy charge ` +
        `(${rs(nextMonth.predicted_bill)} vs ${rs(thisMonth.projected_bill)}).`,
    });
  } else {
    out.push({
      type: "steady",
      message: `${nextMonth.month} should look much like this month (${round(change, 0)}% change).`,
    });
  }

  // Close to a cheaper slab? Say how much to save per day to stay below it.
  const slab = slabFor(nextMonth.predicted_kwh, slabs);
  const lower = slabs.filter((s) => s.max_units !== null && s.max_units < slab.min_units).at(-1);
  if (lower) {
    const perDay = (nextMonth.predicted_kwh - lower.max_units) / nextMonth.days;
    if (perDay > 0 && perDay <= MAX_SAVE_PER_DAY_KWH) {
      const saving = nextMonth.predicted_bill - priceUnits(lower.max_units, slabs);
      out.push({
        type: "slab",
        message:
          `Next month is forecast at ${Math.round(nextMonth.predicted_kwh)} units (slab ${slabName(slab)}). ` +
          `Save about ${round(perDay, 1)} units a day to stay in slab ${slabName(lower)} ` +
          `and pay about ${rs(saving)} less.`,
      });
    }
  }

  const hotDays = nextDays.filter((d) => d.temp_c >= HOT_DAY_C);
  if (hotDays.length) {
    out.push({
      type: "heat",
      message:
        `Hot days ahead (${hotDays.map((d) => d.weekday).join(", ")}, up to ${round(Math.max(...hotDays.map((d) => d.temp_c)), 0)} °C). ` +
        `Close curtains in the afternoon and keep the AC at 26 °C.`,
    });
  } else if (nextDays.length) {
    out.push({
      type: "mild",
      message: `The next ${nextDays.length} days stay at or below ${round(Math.max(...nextDays.map((d) => d.temp_c)), 0)} °C. A fan is often enough; try the AC off in the evening.`,
    });
  }

  return out;
}

export async function getForecast(supabase, deviceId, now = new Date()) {
  const next = nextMonthOf(now);
  const [history, temps, climate, slabs, summary] = await Promise.all([
    getHistory(supabase, deviceId, "30d"),
    getDailyTemps(31, 8),
    getMonthClimate(next.month, now),
    getSlabs(supabase),
    getSummary(supabase, deviceId),
  ]);

  // Training days: complete past days that have both usage and a temperature.
  const today = karachiToday(now);
  const training = history.points
    .filter((p) => p.bucket < today && p.kwh > 0 && temps.has(p.bucket))
    .map((p) => ({ x: cdd(temps.get(p.bucket)), y: p.kwh }));
  if (training.length < MIN_TRAINING_DAYS) {
    return { error: `need at least ${MIN_TRAINING_DAYS} days of usage, have ${training.length}` };
  }
  const { a, b, r2 } = fitLine(training);
  const predict = (t) => Math.max(0, a + b * cdd(t));

  const next_days = [...temps.entries()]
    .filter(([date]) => date > today)
    .slice(0, 7)
    .map(([date, t]) => ({
      date,
      weekday: WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()],
      temp_c: round(t),
      predicted_kwh: round(predict(t)),
    }));

  // Next month from the climate average: mean daily CDD over that month in past years.
  const avgCdd = mean(climate.temps.map(cdd));
  const nextKwh = next.days * (a + b * avgCdd);
  const thisMonth = {
    projected_kwh: summary.projected_month_kwh,
    projected_bill: summary.projected_bill,
  };
  const next_month = {
    month: MONTHS[next.month - 1],
    year: next.year,
    days: next.days,
    avg_temp_c: round(mean(climate.temps)),
    climate_years: climate.years,
    predicted_kwh: round(nextKwh),
    predicted_bill: round(priceUnits(nextKwh, slabs), 0),
    predicted_slab: slabName(slabFor(nextKwh, slabs)),
    change_pct: round(((nextKwh - thisMonth.projected_kwh) / thisMonth.projected_kwh) * 100),
  };

  return {
    model: {
      formula: `daily_kwh = ${round(a, 2)} + ${round(b, 2)} × max(0, temp − ${BASE_TEMP_C} °C)`,
      base_kwh_per_day: round(a, 2),
      kwh_per_degree: round(b, 2),
      r2: round(r2, 2),
      training_days: training.length,
    },
    this_month: thisMonth,
    next_days,
    next_month,
    weather_share_kwh: round(next.days * b * avgCdd),
    weather_share_label: "weather-driven usage (est.), mostly AC; not measured separately",
    suggestions: buildSuggestions({ thisMonth, nextMonth: next_month, nextDays: next_days, slabs }),
    excludes_taxes: true,
  };
}
