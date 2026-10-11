import { getSlabs, getSummary, priceUnits, slabFor } from "@/lib/bill";
import { getHistory } from "@/lib/stats";
import { getClimate, getDailyWeather, getSeasonalForecast } from "@/lib/weather";

// Weather-based usage forecast. One straight line, fitted on the user's own days:
//   daily_kwh = a + b × CDD,   CDD = max(0, daily mean temperature − 24 °C)
// a = base load (fridge, fans, lights), b = extra kWh per degree of heat (mostly AC).
// Next 14 days: detailed daily forecast. Next 12 months: ECMWF seasonal forecast
// (~7 months ahead), then 5-year normals for the months after that.
// Heating and lighting changes are reported, but not added to the kWh numbers:
// the user's data has no cold days yet, so the model can't measure them.

const BASE_TEMP_C = 24;        // cooling degree days above this
const HEAT_TEMP_C = 17;        // months colder than this are "heating season"
const MIN_TRAINING_DAYS = 7;
export const MAX_OUTLOOK_MONTHS = 12;
const NEAR_TERM_MONTHS = 3;    // the headline and up/down lists look this far ahead
const NEXT_DAYS = 14;
const AC_SEASON_KWH = 20;      // a month with at least this much est. AC use counts as AC season
const SEASONAL_SOURCE_MIN_COVERAGE = 0.9;
const CHANGE_THRESHOLD_PCT = 10;
const HOT_DAY_MAX_C = 36;      // daytime high
const STORM_RAIN_CHANCE_PCT = 50;
const MAX_SAVE_PER_DAY_KWH = 3;
const SUNSET_CHANGE_MIN = 10;
const UNUSUAL_C = 1.5;         // mention months this far from normal
const PKT_OFFSET_MS = 5 * 3600 * 1000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const cdd = (t) => Math.max(0, t - BASE_TEMP_C);
const round = (n, d = 1) => Math.round(n * 10 ** d) / 10 ** d;
const rs = (n) => `Rs ${Math.round(n).toLocaleString("en-US")}`;
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
const slabName = (s) => (s.max_units === null ? `${s.min_units}+` : `${s.min_units}-${s.max_units}`);
const pad = (n) => String(n).padStart(2, "0");

function timeLabel(minutes) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${h < 12 ? "am" : "pm"}`;
}

function season(t) {
  if (t >= 30) return "peak summer";
  if (t >= 26) return "summer";
  if (t >= 22) return "warm";
  if (t >= HEAT_TEMP_C) return "mild";
  if (t >= 12) return "winter";
  return "cold winter";
}

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

// Karachi calendar helpers.
function localParts(now) {
  const d = new Date(now.getTime() + PKT_OFFSET_MS);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, today: d.toISOString().slice(0, 10) };
}
function monthDates(year, month) {
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: days }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}
function addMonths(year, month, n) {
  const idx = year * 12 + (month - 1) + n;
  return { year: Math.floor(idx / 12), month: (idx % 12) + 1 };
}

// Weather for one calendar month: per-day ensemble runs from the seasonal forecast,
// falling back to the month's normal (last 5 years) for days it doesn't cover.
// The seasonal forecast reaches ~7 months ahead; later months are normals only.
function monthWeather(year, month, seasonal, climate) {
  const dates = monthDates(year, month);
  const normalTemps = climate.byMonth.get(month).temps;
  const normal = mean(normalTemps);
  // Average CDD over every past day of this month, not CDD of the average:
  // hot and cool days don't cancel out for AC.
  const normalCdd = mean(normalTemps.map(cdd));
  const covered = dates.filter((d) => seasonal.has(d));
  const runCount = covered.length ? seasonal.get(covered[0]).length : 0;

  const days = dates.map((d) => seasonal.get(d) ?? null);
  const dayMeans = days.map((runs) => (runs ? mean(runs) : normal));
  const dayCdd = days.map((runs) => (runs ? mean(runs.map(cdd)) : normalCdd));
  // Spread: each run's monthly mean (uncovered days use the normal), 10th-90th percentile.
  const runMeans = Array.from({ length: runCount }, (_, k) =>
    mean(days.map((runs) => (runs ? (runs[k] ?? runs[0]) : normal)))
  ).sort((x, y) => x - y);
  const pct = (p) => runMeans[Math.min(runMeans.length - 1, Math.floor(p * runMeans.length))];

  const basis =
    covered.length / dates.length >= SEASONAL_SOURCE_MIN_COVERAGE ? "forecast" : covered.length ? "mixed" : "normals";

  return {
    dates,
    temp_c: mean(dayMeans),
    // A spread only means something when the forecast covers the month.
    range_c: basis === "forecast" ? [pct(0.1), pct(0.9)] : null,
    normal_c: normal,
    cdd_per_day: mean(dayCdd),
    basis,
    source: {
      forecast: `seasonal forecast (ECMWF, ${runCount} runs)`,
      mixed: `seasonal forecast for ${covered.length} of ${dates.length} days, ${climate.years} normal for the rest`,
      normals: `${climate.years} normal (beyond the seasonal forecast)`,
    }[basis],
    sunset_min: climate.byMonth.get(month).sunset_min,
    daylight_h: climate.byMonth.get(month).daylight_h,
  };
}

// Headline and what goes down/up over the near term (next 3 months).
function buildOutlook({ thisMonth, months: allMonths }) {
  const months = allMonths.slice(0, NEAR_TERM_MONTHS);
  const first = months[0];
  const last = months.at(-1);
  const decreasing = [];
  const increasing = [];

  // Cooling (AC)
  const acPath =
    `about ${Math.round(thisMonth.ac_kwh_est)} units this month → ` +
    months.map((m) => `${Math.round(m.ac_kwh_est)} in ${m.month}`).join(" → ");
  if (first.ac_kwh_est < thisMonth.ac_kwh_est * 0.67) {
    decreasing.push({ item: "AC / cooling", detail: `${acPath} (estimate).` });
  } else if (first.ac_kwh_est > thisMonth.ac_kwh_est * 1.5 + 5) {
    increasing.push({ item: "AC / cooling", detail: `${acPath} (estimate).` });
  }

  // Lighting: earlier sunset means lights on for longer.
  const earliest = months.reduce((e, m) => (m.sunset_min < e.sunset_min ? m : e));
  const sunsetShift = thisMonth.sunset_min - earliest.sunset_min;
  if (sunsetShift >= SUNSET_CHANGE_MIN) {
    increasing.push({
      item: "Lighting",
      detail:
        `Sunset moves from about ${timeLabel(thisMonth.sunset_min)} now to ${timeLabel(earliest.sunset_min)} in ${earliest.month}, ` +
        `so lights come on about ${Math.round(sunsetShift)} minutes earlier each evening. Not included in the kWh numbers.`,
    });
  } else if (-sunsetShift >= SUNSET_CHANGE_MIN) {
    decreasing.push({ item: "Lighting", detail: `Evenings get about ${Math.round(-sunsetShift)} minutes longer.` });
  }

  // Heating season.
  const cold = months.filter((m) => m.forecast_temp_c < HEAT_TEMP_C);
  if (cold.length) {
    increasing.push({
      item: "Heating (electric heaters, electric geysers)",
      detail:
        `${cold.map((m) => `${m.month} ~${Math.round(m.forecast_temp_c)} °C`).join(", ")}. If you heat rooms or water with electricity, ` +
        `this is what raises winter bills. Your data has no cold days yet, so heating is not in the kWh numbers.`,
    });
  }

  let headline;
  if (decreasing.some((d) => d.item.startsWith("AC"))) {
    const from = `Summer is over. AC use should fall from about ${Math.round(thisMonth.ac_kwh_est)} units this month`;
    const end = last.ac_kwh_est < 5 ? "almost nothing" : `about ${Math.round(last.ac_kwh_est)} units`;
    headline =
      first.ac_kwh_est < 5
        ? `${from} to almost nothing from ${first.month}.`
        : `${from} to about ${Math.round(first.ac_kwh_est)} in ${first.month} and ${end} by ${last.month}.`;
  } else if (increasing.some((d) => d.item.startsWith("AC"))) {
    headline =
      `Summer is coming. AC use should rise from about ${Math.round(thisMonth.ac_kwh_est)} units this month ` +
      `to about ${Math.round(Math.max(...months.map((m) => m.ac_kwh_est)))} a month.`;
  } else {
    headline = `No big change in cooling over the next ${months.length} months.`;
  }
  const rising = increasing.filter((i) => !i.item.startsWith("AC")).map((i) => i.item.split(" (")[0].toLowerCase());
  if (rising.length) headline += ` What goes up instead: ${rising.join(" and ")}.`;

  // Seasonal forecast notably warmer/cooler than a normal year.
  const unusual = months.filter((m) => Math.abs(m.vs_normal_c) >= UNUSUAL_C);
  if (unusual.length) {
    const notes = unusual.map(
      (m) => `${m.month} looks ${m.vs_normal_c > 0 ? "warmer" : "cooler"} than usual (${m.vs_normal_c > 0 ? "+" : ""}${m.vs_normal_c} °C)`
    );
    headline += ` ${notes.join(", ")}.`;
  }

  return { headline, decreasing, increasing };
}

// Whole-period summary: totals, cheapest/most expensive month, when AC season returns.
function buildYear(months) {
  const total_kwh = months.reduce((s, m) => s + m.predicted_kwh, 0);
  const total_bill = months.reduce((s, m) => s + m.predicted_bill, 0);
  const byBill = [...months].sort((x, y) => x.predicted_bill - y.predicted_bill);
  const cheapest = byBill[0];
  const priciest = byBill.at(-1);
  const acReturn = months.find(
    (m, i) => i > 0 && m.ac_kwh_est >= AC_SEASON_KWH && months[i - 1].ac_kwh_est < AC_SEASON_KWH
  );
  const acPeak = months.reduce((p, m) => (m.ac_kwh_est > p.ac_kwh_est ? m : p));
  const forecastMonths = months.filter((m) => m.weather_basis === "forecast");
  const normalMonths = months.filter((m) => m.weather_basis !== "forecast");
  const span = (ms) => (ms.length ? `${ms[0].month.slice(0, 3)} ${ms[0].year}–${ms.at(-1).month.slice(0, 3)} ${ms.at(-1).year}` : null);

  let summary =
    `Next ${months.length} months: about ${Math.round(total_kwh).toLocaleString("en-US")} units and ` +
    `${rs(total_bill)} in energy charges. Cheapest: ${cheapest.month} (${rs(cheapest.predicted_bill)}). ` +
    `Most expensive: ${priciest.month} ${priciest.year} (${rs(priciest.predicted_bill)}).`;
  if (acReturn) {
    summary +=
      ` AC season returns in ${acReturn.month} and peaks in ${acPeak.month} ` +
      `(about ${Math.round(acPeak.ac_kwh_est)} AC units that month).`;
  }

  return {
    summary,
    total_kwh: round(total_kwh),
    total_bill: Math.round(total_bill),
    cheapest_month: { month: cheapest.month, year: cheapest.year, predicted_bill: cheapest.predicted_bill },
    most_expensive_month: { month: priciest.month, year: priciest.year, predicted_bill: priciest.predicted_bill },
    ac_season_returns: acReturn ? { month: acReturn.month, year: acReturn.year } : null,
    ac_peak_month: { month: acPeak.month, year: acPeak.year, ac_kwh_est: acPeak.ac_kwh_est },
    weather_basis: {
      seasonal_forecast: span(forecastMonths),
      mostly_normals: span(normalMonths),
    },
  };
}

function buildSuggestions({ thisMonth, next, nextDays, slabs, outlook }) {
  const out = [];
  const change = next.change_pct;

  if (change >= CHANGE_THRESHOLD_PCT) {
    out.push({
      type: "rising",
      message:
        `${next.month} looks hotter, so AC use will rise: about ${round(change, 0)}% more units ` +
        `(${Math.round(next.predicted_kwh)} vs ${Math.round(thisMonth.projected_kwh)}). ` +
        `Set the AC to 26 °C and run the iron and washing machine outside peak hours.`,
    });
  } else if (change <= -CHANGE_THRESHOLD_PCT) {
    out.push({
      type: "falling",
      message:
        `${next.month} is cooler, so the AC will run less: about ${round(-change, 0)}% fewer units ` +
        `and roughly ${rs(thisMonth.projected_bill - next.predicted_bill)} less on the energy charge ` +
        `(${rs(next.predicted_bill)} vs ${rs(thisMonth.projected_bill)}).`,
    });
  } else {
    out.push({ type: "steady", message: `${next.month} should look much like this month (${round(change, 0)}% change).` });
  }

  // Close to a cheaper slab? Say how much to save per day to stay below it.
  const slab = slabFor(next.predicted_kwh, slabs);
  const lower = slabs.filter((s) => s.max_units !== null && s.max_units < slab.min_units).at(-1);
  if (lower) {
    const perDay = (next.predicted_kwh - lower.max_units) / next.days;
    if (perDay > 0 && perDay <= MAX_SAVE_PER_DAY_KWH) {
      out.push({
        type: "slab",
        message:
          `${next.month} is forecast at ${Math.round(next.predicted_kwh)} units (slab ${slabName(slab)}). ` +
          `Save about ${round(perDay, 1)} units a day to stay in slab ${slabName(lower)} ` +
          `and pay about ${rs(next.predicted_bill - priceUnits(lower.max_units, slabs))} less.`,
      });
    }
  }

  const hotDays = nextDays.filter((d) => d.temp_max_c >= HOT_DAY_MAX_C);
  if (hotDays.length) {
    out.push({
      type: "heat",
      message:
        `Hot days ahead (${hotDays.map((d) => d.weekday).join(", ")}, highs up to ${round(Math.max(...hotDays.map((d) => d.temp_max_c)), 0)} °C). ` +
        `Close curtains in the afternoon and keep the AC at 26 °C.`,
    });
  } else if (nextDays.length) {
    out.push({
      type: "mild",
      message: `Daytime highs stay at or below ${round(Math.max(...nextDays.map((d) => d.temp_max_c)), 0)} °C for the next ${nextDays.length} days. A fan is often enough; try the AC off in the evening.`,
    });
  }

  const stormy = nextDays.filter((d) => d.icon === "storm" && d.rain_chance_pct >= STORM_RAIN_CHANCE_PCT);
  if (stormy.length) {
    out.push({
      type: "storm",
      message:
        `Thunderstorm likely on ${stormy.map((d) => `${d.weekday} (${d.rain_chance_pct}%)`).join(", ")}. ` +
        `Unplug TVs and computers during lightning; voltage spikes and power cuts are common.`,
    });
  }

  if (outlook.increasing.some((i) => i.item === "Lighting")) {
    out.push({
      type: "lighting",
      message: "Evenings get darker earlier. Switch the most-used lights to LED: a 12 W LED gives about the same light as a 60 W bulb.",
    });
  }
  if (outlook.increasing.some((i) => i.item.startsWith("Heating"))) {
    out.push({
      type: "heating",
      message:
        "Before winter: if your geyser or heater is electric, put the geyser on a timer (heat water about an hour before use) " +
        "and run heaters only in the room you're in. A 2,000 W heater for 4 hours a day adds about 240 units a month.",
    });
  }

  return out;
}

export async function getForecast(supabase, deviceId, { months: monthCount = MAX_OUTLOOK_MONTHS, now = new Date() } = {}) {
  const { year, month, today } = localParts(now);
  const [history, weather, seasonal, climate, slabs, summary] = await Promise.all([
    getHistory(supabase, deviceId, "30d"),
    getDailyWeather(31, NEXT_DAYS + 1),
    getSeasonalForecast(),
    getClimate(now),
    getSlabs(supabase),
    getSummary(supabase, deviceId),
  ]);

  const { temps } = weather;

  // Training days: complete past days that have both usage and a temperature.
  const training = history.points
    .filter((p) => p.bucket < today && p.kwh > 0 && temps.has(p.bucket))
    .map((p) => ({ x: cdd(temps.get(p.bucket)), y: p.kwh }));
  if (training.length < MIN_TRAINING_DAYS) {
    return { error: `need at least ${MIN_TRAINING_DAYS} days of usage, have ${training.length}` };
  }
  const { a, b, r2 } = fitLine(training);
  const predict = (t) => Math.max(0, a + b * cdd(t));

  const next_days = weather.days
    .filter((d) => d.date > today && d.temp_mean_c != null)
    .slice(0, NEXT_DAYS)
    .map(({ temp_mean_c, ...d }) => ({
      ...d,
      weekday: WEEKDAYS[new Date(`${d.date}T00:00:00Z`).getUTCDay()],
      temp_mean_c,
      predicted_kwh: round(predict(temp_mean_c)),
    }));

  // This month's estimated AC share: observed/forecast temps where we have them, seasonal otherwise.
  const thisMonthCdd = monthDates(year, month).map((d) =>
    temps.has(d) ? cdd(temps.get(d)) : seasonal.has(d) ? mean(seasonal.get(d).map(cdd)) : cdd(mean(climate.byMonth.get(month).temps))
  );
  const thisMonth = {
    month: MONTHS[month - 1],
    projected_kwh: summary.projected_month_kwh,
    projected_bill: summary.projected_bill,
    ac_kwh_est: round(b * thisMonthCdd.reduce((s, x) => s + x, 0)),
    sunset_min: climate.byMonth.get(month).sunset_min,
  };

  const months = Array.from({ length: monthCount }, (_, i) => {
    const ym = addMonths(year, month, i + 1);
    const w = monthWeather(ym.year, ym.month, seasonal, climate);
    const days = w.dates.length;
    const kwh = days * (a + b * w.cdd_per_day);
    return {
      month: MONTHS[ym.month - 1],
      year: ym.year,
      days,
      season: season(w.temp_c),
      forecast_temp_c: round(w.temp_c),
      likely_range_c: w.range_c && [round(w.range_c[0]), round(w.range_c[1])],
      normal_temp_c: round(w.normal_c),
      vs_normal_c: round(w.temp_c - w.normal_c),
      weather_basis: w.basis,
      weather_source: w.source,
      sunset: timeLabel(w.sunset_min),
      daylight_h: round(w.daylight_h),
      predicted_kwh: round(kwh),
      ac_kwh_est: round(days * b * w.cdd_per_day),
      predicted_bill: round(priceUnits(kwh, slabs), 0),
      predicted_slab: slabName(slabFor(kwh, slabs)),
      change_pct: round(((kwh - thisMonth.projected_kwh) / thisMonth.projected_kwh) * 100),
      sunset_min: w.sunset_min,
    };
  });

  const outlook = buildOutlook({ thisMonth, months });
  const suggestions = buildSuggestions({ thisMonth, next: months[0], nextDays: next_days, slabs, outlook });
  const strip = ({ sunset_min, ...rest }) => rest;

  return {
    model: {
      formula: `daily_kwh = ${round(a, 2)} + ${round(b, 2)} × max(0, temp − ${BASE_TEMP_C} °C)`,
      base_kwh_per_day: round(a, 2),
      kwh_per_degree: round(b, 2),
      r2: round(r2, 2),
      training_days: training.length,
      note: "Cooling only. Heating and lighting changes are listed in outlook, not added to kWh.",
    },
    this_month: strip(thisMonth),
    next_days,
    outlook: { ...outlook, months: months.map(strip) },
    year: monthCount > NEAR_TERM_MONTHS ? buildYear(months) : null,
    weather_share_label: "ac_kwh_est = weather-driven usage (est.), mostly AC; not measured separately",
    suggestions,
    excludes_taxes: true,
  };
}
