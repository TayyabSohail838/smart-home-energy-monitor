"use client";

import { useEffect, useState } from "react";
import { fmtNum, fmtSlabRange } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

// Half-circle gauge (dashboard-design.md §4.4). 180deg = 0 units (pointing
// left), 360deg/0deg = scaleMax units (pointing right); the sweep in between
// passes through 270deg (straight up), so the dial reads left-to-right along
// the top the way a real meter dial does.
const CX = 100;
const CY = 104;
const R = 80;
const TRACK = 15;

const angleFor = (units, scaleMax) => 180 + Math.min(1, Math.max(0, units / scaleMax)) * 180;
const point = (angleDeg, radius) => {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
};

// Zone colour, cooler to warmer across the shown slabs (dashboard-design.md §4.4).
const STOPS = [
  [42, 120, 214], // blue
  [235, 104, 52], // orange
  [200, 48, 44], // red
];
function zoneColor(i, n) {
  const t = n <= 1 ? 0 : i / (n - 1);
  const seg = t * (STOPS.length - 1);
  const lo = Math.floor(seg);
  const hi = Math.min(STOPS.length - 1, lo + 1);
  const f = seg - lo;
  const [r, g, b] = STOPS[lo].map((c, k) => Math.round(c + (STOPS[hi][k] - c) * f));
  return `rgb(${r}, ${g}, ${b})`;
}

function Needle({ angle, grow, ghost }) {
  const length = R - TRACK / 2 - 6;
  return (
    <g
      style={{
        transform: `translate(${CX}px, ${CY}px) rotate(${grow ? angle : 180}deg)`,
        transition: "transform 600ms cubic-bezier(0.2, 0.7, 0.2, 1)",
      }}
    >
      <line
        x1="0"
        y1="0"
        x2={length}
        y2="0"
        stroke={ghost ? "var(--ink-soft)" : "var(--ink)"}
        strokeWidth={ghost ? 2 : 3}
        strokeDasharray={ghost ? "2 3" : undefined}
        strokeLinecap="round"
      />
    </g>
  );
}

export default function SlabDial({ used, projected, currentSlab, nextSlab, unitsToNextSlab, projectedSlab }) {
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

  if (!slabs.length || used == null || projected == null) {
    return <div className="skeleton h-[170px] w-full rounded-md" />;
  }

  const capped = slabs.filter((s) => s.max_units !== null);
  const scaleMax = Math.max(
    capped.find((s) => s.max_units >= projected)?.max_units ?? capped.at(-1).max_units,
    used
  );
  const shown = slabs.filter((s) => s.min_units <= scaleMax);

  const overSlab = projectedSlab && currentSlab && projectedSlab.min_units > currentSlab.min_units;
  const ariaLabel = `Current ${fmtNum(used)} units, slab ${currentSlab ? fmtSlabRange(currentSlab) : "–"}. Projected ${fmtNum(
    projected
  )} units, slab ${projectedSlab ? fmtSlabRange(projectedSlab).replace("+", " and above") : "–"}.`;

  return (
    <div>
      <svg viewBox="0 0 200 120" className="w-full" role="img" aria-label={ariaLabel}>
        {shown.map((s, i) => {
          const start = i === 0 ? 0 : shown[i - 1].max_units;
          const end = Math.min(s.max_units ?? scaleMax, scaleMax);
          const a0 = angleFor(start, scaleMax);
          const a1 = angleFor(end, scaleMax);
          const [x0, y0] = point(a0, R);
          const [x1, y1] = point(a1, R);
          return (
            <path
              key={s.id}
              d={`M ${x0} ${y0} A ${R} ${R} 0 0 1 ${x1} ${y1}`}
              fill="none"
              stroke={zoneColor(i, shown.length)}
              strokeWidth={TRACK}
            />
          );
        })}

        {shown.map((s, i) => {
          const start = i === 0 ? 0 : shown[i - 1].max_units;
          const end = Math.min(s.max_units ?? scaleMax, scaleMax);
          const [lx, ly] = point(angleFor((start + end) / 2, scaleMax), R + TRACK / 2 + 11);
          return (
            <text key={s.id} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="7" className="font-bill" fill="var(--ink-soft)">
              {fmtSlabRange(s)}
            </text>
          );
        })}

        <Needle angle={angleFor(projected, scaleMax)} grow={grow} ghost />
        <Needle angle={angleFor(used, scaleMax)} grow={grow} />
        <circle cx={CX} cy={CY} r="4" fill="var(--ink)" />
      </svg>

      <p className="text-center font-bill text-xs text-ink-soft">
        {nextSlab ? (
          <>
            {fmtNum(unitsToNextSlab)} UNITS TO NEXT SLAB
          </>
        ) : (
          "TOP SLAB · no slab above this"
        )}
      </p>
      {overSlab && (
        <p className="mt-1 text-center font-bill text-xs text-[var(--stamp-red)]">
          ⚠ PROJECTED: {fmtSlabRange(projectedSlab)} SLAB
        </p>
      )}
    </div>
  );
}
