// Weather from Open-Meteo (free, no API key) for the one home location in HOME_LAT / HOME_LON.
// Three sources:
//   - forecast API: the last ~31 days and the next 14 days (conditions, high/low, rain, wind)
//   - seasonal API: ECMWF seasonal forecast, ~51 ensemble runs, ~7 months ahead.
//     It predicts monthly tendencies (warmer/cooler than normal), not exact daily weather.
//   - archive API: the last 5 full years, for "normal" temperature and sunset per month
// Results are cached in memory.

const FORECAST_TTL_MS = 60 * 60 * 1000;
const SEASONAL_TTL_MS = 6 * 60 * 60 * 1000;
const CLIMATE_TTL_MS = 24 * 60 * 60 * 1000;
const SEASONAL_DAYS = 217; // the most Open-Meteo allows (~7 months)
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

// WMO weather codes -> short description + icon name for the UI.
const CONDITIONS = [
  [[0], "Clear", "sun"],
  [[1], "Mostly clear", "sun"],
  [[2], "Partly cloudy", "partly-cloudy"],
  [[3], "Cloudy", "cloud"],
  [[45, 48], "Fog", "fog"],
  [[51, 53, 55, 56, 57], "Drizzle", "drizzle"],
  [[61, 63, 65, 66, 67], "Rain", "rain"],
  [[80, 81, 82], "Rain showers", "rain"],
  [[71, 73, 75, 77, 85, 86], "Snow", "snow"],
  [[95, 96, 99], "Thunderstorm", "storm"],
];
function condition(code) {
  const hit = CONDITIONS.find(([codes]) => codes.includes(code));
  return hit ? { condition: hit[1], icon: hit[2] } : { condition: "Unknown", icon: "cloud" };
}

const DAILY_VARS = [
  "weather_code", "temperature_2m_max", "temperature_2m_min", "temperature_2m_mean",
  "precipitation_probability_max", "precipitation_sum", "wind_speed_10m_max",
  "relative_humidity_2m_mean", "sunrise", "sunset",
].join(",");

// Daily weather for the past `pastDays` and next `futureDays` (max 16), Karachi dates.
// Returns { temps: Map(date -> mean °C), days: [{ date, condition, icon, temp_max_c, ... }] }.
// Recent past days come from the forecast API because the archive API lags ~5 days.
export async function getDailyWeather(pastDays = 31, futureDays = 15) {
  const url =
    `https://api.open-meteo.com/v1/forecast?${location()}` +
    `&daily=${DAILY_VARS}&past_days=${pastDays}&forecast_days=${futureDays}` +
    `&timezone=Asia%2FKarachi`;
  const { daily: d } = await cachedJson(url, FORECAST_TTL_MS);

  const temps = new Map();
  const days = d.time.map((date, i) => {
    if (d.temperature_2m_mean[i] != null) temps.set(date, d.temperature_2m_mean[i]);
    return {
      date,
      ...condition(d.weather_code[i]),
      temp_max_c: d.temperature_2m_max[i],
      temp_min_c: d.temperature_2m_min[i],
      temp_mean_c: d.temperature_2m_mean[i],
      rain_chance_pct: d.precipitation_probability_max[i],
      rain_mm: d.precipitation_sum[i],
      wind_max_kmh: d.wind_speed_10m_max[i],
      humidity_pct: d.relative_humidity_2m_mean[i],
      sunrise: d.sunrise[i]?.slice(11, 16) ?? null,
      sunset: d.sunset[i]?.slice(11, 16) ?? null,
    };
  });
  return { temps, days };
}

// Map "YYYY-MM-DD" -> array of daily mean °C, one per ensemble run (up to 51).
export async function getSeasonalForecast() {
  const url =
    `https://seasonal-api.open-meteo.com/v1/seasonal?${location()}` +
    `&daily=temperature_2m_mean&forecast_days=${SEASONAL_DAYS}&timezone=Asia%2FKarachi`;
  const { daily } = await cachedJson(url, SEASONAL_TTL_MS);

  const members = Object.keys(daily).filter((k) => k.startsWith("temperature_2m_mean_member"));
  const days = new Map();
  daily.time.forEach((date, i) => {
    const runs = members.map((k) => daily[k][i]).filter((v) => v != null);
    if (runs.length) days.set(date, runs);
  });
  return days;
}

// Normal weather per calendar month (1-12) over the last 5 full years:
// { temps: [daily means], sunset_min: average sunset in minutes after midnight, daylight_h }.
export async function getClimate(now = new Date()) {
  const lastYear = now.getUTCFullYear() - 1;
  const url =
    `https://archive-api.open-meteo.com/v1/archive?${location()}` +
    `&start_date=${lastYear - CLIMATE_YEARS + 1}-01-01&end_date=${lastYear}-12-31` +
    `&daily=temperature_2m_mean,sunset,daylight_duration&timezone=Asia%2FKarachi`;
  const { daily } = await cachedJson(url, CLIMATE_TTL_MS);

  const months = new Map();
  daily.time.forEach((date, i) => {
    const m = Number(date.slice(5, 7));
    const entry = months.get(m) ?? { temps: [], sunsets: [], daylight: [] };
    if (daily.temperature_2m_mean[i] != null) entry.temps.push(daily.temperature_2m_mean[i]);
    if (daily.sunset[i]) {
      const [h, min] = daily.sunset[i].slice(11, 16).split(":").map(Number);
      entry.sunsets.push(h * 60 + min);
    }
    if (daily.daylight_duration[i] != null) entry.daylight.push(daily.daylight_duration[i] / 3600);
    months.set(m, entry);
  });

  const avg = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const climate = new Map();
  for (const [m, e] of months) {
    climate.set(m, { temps: e.temps, sunset_min: avg(e.sunsets), daylight_h: avg(e.daylight) });
  }
  return { byMonth: climate, years: `${lastYear - CLIMATE_YEARS + 1}-${lastYear}` };
}
