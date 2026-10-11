"use client";

import { useEffect, useState } from "react";
import { fmtNum } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

// Horizontal meter of the tariff slabs with markers for units used so far and the
// month-end projection. The bar animates in from zero.
export default function SlabMeter({ used, projected, currentSlabId }) {
  const [slabs, setSlabs] = useState([]);
  const [grow, setGrow] = useState(false);

  useEffect(() => {
    getSupabase()
      .from("tariff_slabs")
      .select("id, min_units, max_units, rate_per_unit")
      .order("min_units")
      .then(({ data }) => setSlabs(data ?? []));
    const t = setTimeout(() => setGrow(true), 150);
    return () => clearTimeout(t);
  }, []);

  if (!slabs.length) return <div className="skeleton h-16 w-full" />;

  // Scale: up to the slab after the projection (or the last capped slab).
  const capped = slabs.filter((s) => s.max_units !== null);
  const scaleMax = Math.max(
    capped.find((s) => s.max_units >= projected)?.max_units ?? capped.at(-1).max_units,
    used
  );
  const pct = (u) => `${Math.min(100, (u / scaleMax) * 100)}%`;
  const shown = slabs.filter((s) => s.min_units <= scaleMax);

  return (
    <div>
      <div className="relative h-3 overflow-hidden rounded-full bg-black/5">
        {/* projection (light) */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#9ec5f4] transition-[width] duration-[1200ms] ease-out"
          style={{ width: grow ? pct(projected) : "0%" }}
        />
        {/* used so far */}
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-[#2a78d6] transition-[width] duration-1000 ease-out"
          style={{ width: grow ? pct(used) : "0%" }}
        />
        {/* slab boundaries */}
        {shown.slice(0, -1).map((s) => (
          <span key={s.id} className="absolute inset-y-0 w-[2px] bg-white" style={{ left: pct(s.max_units) }} />
        ))}
      </div>

      <div className="relative mt-1.5 h-4 text-[10px] text-ink-3">
        {shown.slice(0, -1).map((s) => (
          <span key={s.id} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(s.max_units) }}>
            {s.max_units}
          </span>
        ))}
      </div>

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#2a78d6]" /> Used: {fmtNum(used)} units
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-[#9ec5f4]" /> Projected: {fmtNum(projected)} units
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {shown.map((s) => (
          <span
            key={s.id}
            className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
              s.id === currentSlabId ? "bg-ink text-white" : "bg-white/70 text-ink-2 ring-1 ring-black/5"
            }`}
          >
            {s.max_units === null ? `${s.min_units}+` : `${s.min_units}–${s.max_units}`} · Rs {fmtNum(Number(s.rate_per_unit), 2)}
          </span>
        ))}
      </div>
    </div>
  );
}
