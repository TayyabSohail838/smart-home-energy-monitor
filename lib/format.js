// Display helpers shared by the dashboard (safe in the browser).

export const fmtNum = (n, digits = 0) =>
  n == null || Number.isNaN(n)
    ? "–"
    : Number(n).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });

export const fmtRs = (n) => (n == null ? "–" : `Rs ${fmtNum(Math.round(n))}`);
export const fmtKwh = (n, digits = 1) => `${fmtNum(n, digits)} kWh`;
export const fmtW = (n) => (n == null ? "–" : n >= 1000 ? `${fmtNum(n / 1000, 2)} kW` : `${fmtNum(n)} W`);

// 0 -> "12 am", 13 -> "1 pm"
export function hourLabel(h) {
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${h % 24 < 12 ? "am" : "pm"}`;
}

const PKT = "Asia/Karachi";

export function timeAgo(iso, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}

export const fmtTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: PKT, hour: "numeric", minute: "2-digit" });

export const fmtDateTime = (iso) =>
  new Date(iso).toLocaleString("en-US", { timeZone: PKT, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// "2026-10-12" -> "12 Oct"
export function fmtDay(date) {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]}`;
}

export const WEATHER_EMOJI = {
  sun: "☀️",
  "partly-cloudy": "⛅",
  cloud: "☁️",
  fog: "🌫️",
  drizzle: "🌦️",
  rain: "🌧️",
  snow: "❄️",
  storm: "⛈️",
};
