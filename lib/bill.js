import { getHistory } from "@/lib/stats";

// How slab pricing works. Tariff rules change, so this is the one switch:
//   "single_rate" - ALL units at the rate of the slab the total falls in
//                   (unprotected residential, NEPRA 2026). 501 units costs more than 500.
//   "tiered"      - each slab's units at that slab's own rate (like income tax brackets).
export const SLAB_MODE = "single_rate";

const PKT_OFFSET_MS = 5 * 3600 * 1000; // Asia/Karachi is UTC+5 all year

// Slabs ordered by min_units, rates as numbers.
export async function getSlabs(supabase) {
  const { data, error } = await supabase
    .from("tariff_slabs")
    .select("id, min_units, max_units, rate_per_unit")
    .order("min_units");
  if (error) throw new Error(`tariff_slabs: ${error.message}`);
  if (!data.length) throw new Error("tariff_slabs is empty");
  return data.map((s) => ({ ...s, rate_per_unit: Number(s.rate_per_unit) }));
}

// The slab a monthly total falls in. 500.4 units is past 500, so it's in 501-600.
export function slabFor(units, slabs) {
  return slabs.find((s) => s.max_units === null || units <= s.max_units) ?? slabs.at(-1);
}

// Energy charge in PKR for a month's units.
export function priceUnits(units, slabs, mode = SLAB_MODE) {
  if (units <= 0) return 0;
  if (mode === "single_rate") return units * slabFor(units, slabs).rate_per_unit;

  let total = 0;
  for (const s of slabs) {
    const from = s.min_units - 1;
    const to = s.max_units ?? Infinity;
    if (units > from) total += (Math.min(units, to) - from) * s.rate_per_unit;
  }
  return total;
}

// Month-end estimate: units so far / days passed x days in month (Karachi calendar).
// Days passed is fractional (11 Oct, 6 am = 10.25) so mornings don't under-project.
export function projectMonth(unitsSoFar, now = new Date()) {
  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  const daysInMonth = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth() + 1, 0)).getUTCDate();
  const daysPassed =
    local.getUTCDate() - 1 +
    (local.getUTCHours() * 3600 + local.getUTCMinutes() * 60 + local.getUTCSeconds()) / 86400;
  const projected = daysPassed > 0 ? (unitsSoFar / daysPassed) * daysInMonth : unitsSoFar;
  return { projected, daysPassed, daysInMonth };
}

const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const slabOut = (s) => s && { id: s.id, min_units: s.min_units, max_units: s.max_units, rate_per_unit: s.rate_per_unit };

// Everything the Home page needs: today/month kWh, bill so far, slab position, projection.
export async function getSummary(supabase, deviceId) {
  const [month, slabs] = await Promise.all([
    getHistory(supabase, deviceId, "month"),
    getSlabs(supabase),
  ]);

  const month_kwh = month.total_kwh;
  const today_kwh = month.points.at(-1)?.kwh ?? 0;
  const current = slabFor(month_kwh, slabs);
  const { projected, daysPassed, daysInMonth } = projectMonth(month_kwh);
  const projectedSlab = slabFor(projected, slabs);

  return {
    today_kwh: round(today_kwh, 3),
    month_kwh: round(month_kwh, 3),
    bill_so_far: round(priceUnits(month_kwh, slabs)),
    current_slab: slabOut(current),
    units_to_next_slab: current.max_units === null ? null : round(current.max_units - month_kwh),
    projected_month_kwh: round(projected, 1),
    projected_bill: round(priceUnits(projected, slabs)),
    projected_slab: slabOut(projectedSlab),
    days_passed: round(daysPassed),
    days_in_month: daysInMonth,
    slab_mode: SLAB_MODE,
    currency: "PKR",
    excludes_taxes: true, // energy charge only: no taxes, fuel adjustment or fixed charges
  };
}
