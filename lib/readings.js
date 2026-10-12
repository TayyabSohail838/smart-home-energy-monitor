const MAX_BATCH = 1000;              // ESP32 backlog after a reconnect
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;     // allow the device clock to run up to 1 min fast
const MAX_VOLTAGE_V = 500;           // matches the readings.voltage_v check
const SOURCES = ["pzem", "laptop", "test", "simulated"]; // matches the readings.source check

function isNonNegativeNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}

// Checks one item. Returns null if it is a usable row, or why it isn't.
function rowFor(r, deviceId, now) {
  if (!r || typeof r !== "object") return { reason: "not an object" };

  const t = typeof r.ts === "string" ? Date.parse(r.ts) : NaN;
  if (Number.isNaN(t)) return { reason: "ts must be an ISO date string" };
  if (t > now + CLOCK_SKEW_MS) return { reason: "ts is in the future" };
  if (t < now - MAX_AGE_MS) return { reason: "ts is older than 24 h" };

  for (const field of ["current_a", "power_w", "energy_wh"]) {
    if (!isNonNegativeNumber(r[field])) return { reason: `${field} must be a number >= 0` };
  }

  const row = {
    device_id: deviceId,
    ts: new Date(t).toISOString(),
    current_a: r.current_a,
    power_w: r.power_w,
    energy_wh: r.energy_wh,
  };
  // Optional (the PZEM measures it; older firmware doesn't send it). An implausible
  // value is dropped rather than losing the energy reading with it.
  if (isNonNegativeNumber(r.voltage_v) && r.voltage_v <= MAX_VOLTAGE_V) row.voltage_v = r.voltage_v;
  // Optional label of where the reading came from (supabase/source.sql).
  if (SOURCES.includes(r.source)) row.source = r.source;
  return { row };
}

// Turns a request body (one reading or an array) into rows for the readings table.
// Returns { rows, skipped, firstSkipReason } or { error }.
//
// Bad *items* are skipped and counted, never rejected: a stale backlog entry, a
// device clock that is a few minutes fast, or one corrupt row must not make the
// ESP32 retry the whole batch forever. The response reports the counts so the
// problem is still visible.
//
// Only two things fail the request outright, because a correctly configured
// device can never send them and retrying will not help:
//   - a body that isn't a reading or a non-empty array of at most MAX_BATCH
//   - a device_id that doesn't match the authenticated device (misdirected write)
export function parseReadings(body, deviceId, now = Date.now()) {
  const items = Array.isArray(body) ? body : [body];
  if (items.length === 0) return { error: "no readings" };
  if (items.length > MAX_BATCH) return { error: `max ${MAX_BATCH} readings per request` };

  const rows = [];
  let skipped = 0;
  let firstSkipReason = null;

  for (const [i, r] of items.entries()) {
    if (r && typeof r === "object" && r.device_id !== undefined && r.device_id !== deviceId) {
      return { error: `reading ${i}: device_id mismatch` };
    }

    const { row, reason } = rowFor(r, deviceId, now);
    if (row) {
      rows.push(row);
    } else {
      skipped++;
      firstSkipReason ??= `reading ${i}: ${reason}`;
    }
  }

  return { rows, skipped, firstSkipReason };
}
