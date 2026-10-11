import { createAlert, hasRecentAlert } from "@/lib/alerts";
import { getSummary } from "@/lib/bill";
import { supabaseAdmin } from "@/lib/supabase/admin";

const CHECK_EVERY_MS = 10 * 60 * 1000; // the projection moves slowly; check at most every 10 min
const PKT_OFFSET_MS = 5 * 3600 * 1000;
const lastChecked = new Map();

const slabName = (s) => (s.max_units === null ? `${s.min_units}+` : `${s.min_units}-${s.max_units}`);
const rs = (n) => `Rs ${Math.round(n).toLocaleString("en-US")}`;

// Start of this calendar month in Karachi, as a UTC ISO string.
function monthStartIso(now) {
  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - PKT_OFFSET_MS).toISOString();
}

// Runs after each insert (throttled). Warns when the month-end projection lands in a
// higher slab than the units used so far. At most once per slab per month.
export async function checkSlab(deviceId, now = new Date()) {
  const last = lastChecked.get(deviceId) ?? 0;
  if (now.getTime() - last < CHECK_EVERY_MS) return { warned: false, reason: "checked recently" };
  lastChecked.set(deviceId, now.getTime());

  const s = await getSummary(supabaseAdmin, deviceId);
  if (s.projected_slab.id <= s.current_slab.id) return { warned: false, reason: "same slab" };

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
