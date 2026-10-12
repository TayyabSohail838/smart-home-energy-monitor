import { createAlert, hasRecentAlert } from "@/lib/alerts";
import { getSlabs, getSummary, priceUnits } from "@/lib/bill";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CHECK_EVERY_MS = 10 * 60 * 1000; // units move slowly; check at most every 10 min
const NEAR_LIMIT_UNITS = 10; // warn at 90, 190, 290, ... units
const PKT_OFFSET_MS = 5 * 3600 * 1000;
const lastChecked = new Map();

const slabName = (s) => (s.max_units === null ? `${s.min_units}+` : `${s.min_units}-${s.max_units}`);
const rate = (n) => `Rs ${Number(n).toFixed(2)}`;
const unitsWord = (n) => `${n} unit${n === 1 ? "" : "s"}`;
const rs = (n) => `Rs ${Math.round(n).toLocaleString("en-US")}`;

// Start of this calendar month in Karachi, as a UTC ISO string.
function monthStartIso(now) {
  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - PKT_OFFSET_MS).toISOString();
}

// Runs after each insert (throttled). Two warnings, each at most once per slab per month:
// the units used so far are within 10 of the slab limit, and the month-end projection
// lands in a higher slab.
export async function checkSlab(deviceId, now = new Date()) {
  const last = lastChecked.get(deviceId) ?? 0;
  if (now.getTime() - last < CHECK_EVERY_MS) return { warned: false, reason: "checked recently" };
  lastChecked.set(deviceId, now.getTime());

  const s = await getSummary(supabaseAdmin, deviceId);
  const near = await checkNearLimit(deviceId, s, now);
  const projected = await checkProjection(deviceId, s, now);
  const warned = [near, projected].filter((r) => r.warned);
  return warned.length
    ? { warned: true, alert_ids: warned.map((r) => r.alert_id), message: warned.map((r) => r.message).join(" | ") }
    : { warned: false, reason: `${near.reason}; ${projected.reason}` };
}

// Units used so far are within NEAR_LIMIT_UNITS of the current slab's upper limit.
async function checkNearLimit(deviceId, s, now) {
  const limit = s.current_slab.max_units;
  if (limit === null || !s.next_slab) return { warned: false, reason: "top slab" };
  const left = limit - s.month_kwh;
  if (left > NEAR_LIMIT_UNITS) return { warned: false, reason: `${Math.ceil(left)} units left` };

  // "Unit 201 moves you" is the once-per-slab-per-month key (the projection warning
  // never contains it, so the two don't block each other).
  const key = `Unit ${limit + 1} moves you`;
  if (await hasRecentAlert(deviceId, "slab_warning", monthStartIso(now), key)) {
    return { warned: false, reason: "already warned near this limit" };
  }

  const slabs = await getSlabs(supabaseAdmin);
  const billAfter = priceUnits(limit + 1, slabs);
  const unitsLeft = unitsWord(Math.max(0, Math.ceil(left)));
  const message =
    `You've used ${Math.floor(s.month_kwh)} units this month: only ${unitsLeft} left in slab ${slabName(s.current_slab)}. ` +
    `${key} into the ${slabName(s.next_slab)} slab, and every unit this month is then charged at ` +
    `${rate(s.next_slab.rate_per_unit)} instead of ${rate(s.current_slab.rate_per_unit)}: ` +
    `the bill jumps from about ${rs(s.bill_so_far)} to ${rs(billAfter)}. ` +
    `Cut AC, iron and geyser use for the rest of the month to stay under ${limit}. ` +
    `Energy charge only; taxes and fuel adjustment not included.`;

  const alert = await createAlert({
    deviceId,
    type: "slab_warning",
    message,
    subject: `${unitsLeft} left before your bill jumps`,
  });
  return { warned: true, alert_id: alert.id, message };
}

// Month-end projection lands in a higher slab than the units used so far.
async function checkProjection(deviceId, s, now) {
  // Compare where the slabs sit on the units scale, not their primary keys:
  // nothing guarantees id order matches min_units order.
  if (s.projected_slab.min_units <= s.current_slab.min_units) {
    return { warned: false, reason: "same slab" };
  }

  // The slab name in the message doubles as the "once per slab per month" key.
  const key = `slab ${slabName(s.projected_slab)}`;
  if (await hasRecentAlert(deviceId, "slab_warning", monthStartIso(now), key)) {
    return { warned: false, reason: "already warned for this slab" };
  }

  const message =
    `At this rate you'll use about ${Math.round(s.projected_month_kwh)} units this month, ` +
    `which puts you in ${key} (Rs ${s.projected_slab.rate_per_unit}/unit, est. ${rs(s.projected_bill)}). ` +
    `So far: ${Math.round(s.month_kwh)} units, ${rs(s.bill_so_far)}. ` +
    `Energy charge only; taxes and fuel adjustment not included.`;

  const alert = await createAlert({ deviceId, type: "slab_warning", message });
  return { warned: true, alert_id: alert.id, message };
}
