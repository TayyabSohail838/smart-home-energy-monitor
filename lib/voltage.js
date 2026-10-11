import { createAlert, hasRecentAlert } from "@/lib/alerts";

// High-voltage alert: Pakistani mains is nominally 230 V; above 250 V appliances
// (fridge, AC compressor, TV) can be damaged.
export const HIGH_VOLTAGE_V = 250;
const COOLDOWN_MS = 30 * 60 * 1000; // at most one voltage alert per device per 30 min

const pkTime = (iso) =>
  new Date(iso).toLocaleTimeString("en-US", { timeZone: "Asia/Karachi", hour: "numeric", minute: "2-digit" });

// Runs after each insert on the rows just stored. Alerts on the highest reading over
// the limit in this batch (a reconnect backlog may hold several).
export async function checkVoltage(deviceId, rows, now = new Date()) {
  const high = rows.filter((r) => r.voltage_v > HIGH_VOLTAGE_V);
  if (high.length === 0) return { alerted: false, reason: "normal" };

  if (await hasRecentAlert(deviceId, "voltage", new Date(now.getTime() - COOLDOWN_MS).toISOString())) {
    return { alerted: false, reason: "cooldown" };
  }

  const worst = high.reduce((a, b) => (b.voltage_v > a.voltage_v ? b : a));
  const volts = Math.round(worst.voltage_v);
  const message =
    `High voltage: ${volts} V at ${pkTime(worst.ts)} (normal is about 230 V; above ${HIGH_VOLTAGE_V} V can damage appliances). ` +
    `Switch off sensitive appliances like the fridge, AC and TV, or run them through a stabilizer, ` +
    `and report it to FESCO if it keeps happening.`;

  const alert = await createAlert({
    deviceId,
    type: "voltage",
    message,
    powerW: worst.power_w,
    subject: `High voltage: ${volts} V`,
  });
  return { alerted: true, alert_id: alert.id, message };
}
