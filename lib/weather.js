// Weather from Open-Meteo (free, no API key) for the one home location in HOME_LAT / HOME_LON.
// Results are cached in memory: forecasts for 1 hour, climate averages for 1 day.

const FORECAST_TTL_MS = 60 * 60 * 1000;
const CLIMATE_TTL_MS = 24 * 60 * 60 * 1000;
const CLIMATE_YEARS = 5;
const cache = new Map();

async function cachedJson(url, ttlMs) {
  const hit = cache.get(url);
  if (hit && hit.expires > Date.now()) return hit.value;

  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const value = await res.json();
  cache.set(url, { value, expires: Date.now() + ttlMs });
  return value;
}

function location() {
  const { HOME_LAT: lat, HOME_LON: lon } = process.env;
  if (!lat || !lon) throw new Error("HOME_LAT and HOME_LON are not set");
  return `latitude=${lat}&longitude=${lon}`;
}

// Daily mean temperature (°C) for the past `pastDays` days and the next `futureDays` days,
// keyed by Karachi date "YYYY-MM-DD". Recent past days come from the forecast API,
// because the archive API lags about 5 days.
export async function getDailyTemps(pastDays = 31, futureDays = 8) {
  const url =
    `https://api.open-meteo.com/v1/forecast?${location()}` +
    `&daily=temperature_2m_mean&past_days=${pastDays}&forecast_days=${futureDays}` +
    `&timezone=Asia%2FKarachi`;
  const { daily } = await cachedJson(url, FORECAST_TTL_MS);

  const temps = new Map();
  daily.time.forEach((date, i) => {
    if (daily.temperature_2m_mean[i] != null) temps.set(date, daily.temperature_2m_mean[i]);
  });
  return temps;
}

// Climate average for a calendar month (1-12) over the last 5 full years:
// the daily mean temperatures of every day in that month, so callers can average
// anything (temperature, cooling degrees) per day. A real month-ahead weather
// forecast doesn't exist; this is "a typical November", not "this November".
export async function getMonthClimate(month, now = new Date()) {
  const lastYear = now.getUTCFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?${location()}` +
    `&start_date=${lastYear - CLIMATE_YEARS + 1}-01-01&end_date=${lastYear}-12-31` +
    `&daily=temperature_2m_mean&timezone=Asia%2FKarachi`;
  const { daily } = await cachedJson(url, CLIMATE_TTL_MS);

  const temps = daily.time
    .map((date, i) => ({ month: Number(date.slice(5, 7)), t: daily.temperature_2m_mean[i] }))
    .filter((d) => d.month === month && d.t != null)
    .map((d) => d.t);
  return { temps, years: `${lastYear - CLIMATE_YEARS + 1}-${lastYear}` };
}
