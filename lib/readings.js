const MAX_BATCH = 1000;              // ESP32 backlog after a reconnect
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;     // allow the device clock to run up to 1 min fast

function isNonNegativeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

// Turns a request body (one reading or an array) into rows for the readings table.
// Returns { rows, skipped } or { error }.
// Readings older than 24 h are skipped, not rejected, so one stale backlog item
// can't make the ESP32 retry the whole batch forever.
export function parseReadings(body, deviceId, now = Date.now()) {
  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) return { error: "no readings" };
  if (items.length > MAX_BATCH) return { error: `max ${MAX_BATCH} readings per request` };

  const rows = [];
  let skipped = 0;

  for (const [i, r] of items.entries()) {
    if (!r || typeof r !== "object") return { error: `reading ${i}: not an object` };
    if (r.device_id !== undefined && r.device_id !== deviceId) {
      return { error: `reading ${i}: device_id mismatch` };
    }

    const t = typeof r.ts === "string" ? Date.parse(r.ts) : NaN;
    if (Number.isNaN(t)) return { error: `reading ${i}: ts must be an ISO date string` };
    if (t > now + CLOCK_SKEW_MS) return { error: `reading ${i}: ts is in the future` };

    for (const field of ["current_a", "power_w", "energy_wh"]) {
      if (!isNonNegativeNumber(r[field])) {
        return { error: `reading ${i}: ${field} must be a number >= 0` };
      }
    }

    if (t < now - MAX_AGE_MS) {
      skipped++;
      continue;
    }

    rows.push({
      device_id: deviceId,
      ts: new Date(t).toISOString(),
      current_a: r.current_a,
      power_w: r.power_w,
      energy_wh: r.energy_wh,
    });
  }

  return { rows, skipped };
}
