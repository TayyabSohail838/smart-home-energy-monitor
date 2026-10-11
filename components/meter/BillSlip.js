"use client";

import { fmtRs } from "@/lib/format";

// A torn paper slip (dashboard-design.md §4.4). The zig-zag bottom edge is a
// fixed clip-path computed once at module load, not per render.
function zigzagClipPath(teeth = 10, depthPct = 8) {
  const pts = ["0% 0%", "100% 0%"];
  for (let i = teeth; i >= 0; i--) {
    const x = (i / teeth) * 100;
    const y = i % 2 === 0 ? 100 : 100 - depthPct;
    pts.push(`${x}% ${y}%`);
  }
  return `polygon(${pts.join(", ")})`;
}
const SLIP_CLIP = zigzagClipPath();

export default function BillSlip({ billSoFar, projectedBill, slabMode, rate }) {
  return (
    <div className="border-x border-t border-ink bg-paper-grain px-4 pb-8 pt-4" style={{ clipPath: SLIP_CLIP }}>
      <dl className="space-y-2 font-bill text-xs">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="uppercase tracking-wide text-ink-soft">Bill so far</dt>
          <dd className="text-base text-ink">{billSoFar != null ? fmtRs(billSoFar) : "–"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="uppercase tracking-wide text-ink-soft">Projected</dt>
          <dd className="text-base text-ink">{projectedBill != null ? fmtRs(projectedBill) : "–"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 border-t border-dotted border-rule pt-2">
          <dt className="uppercase tracking-wide text-ink-soft">Rate now</dt>
          <dd className="text-ink">{rate != null ? `Rs ${rate} /unit` : "–"}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="uppercase tracking-wide text-ink-soft">Slab mode</dt>
          <dd className="capitalize text-ink">{slabMode === "tiered" ? "Tiered" : "Single rate"}</dd>
        </div>
      </dl>
      <p className="mt-3 font-bill text-[10px] leading-relaxed text-ink-soft">Energy charge only, excludes taxes.</p>
    </div>
  );
}
