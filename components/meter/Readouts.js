"use client";

import { fmtNum, fmtTime } from "@/lib/format";

function fmtPower(w) {
  if (w == null) return "–";
  return w >= 1000 ? `${fmtNum(w / 1000, 2)} kW` : `${fmtNum(w)} W`;
}

// Printed-style readouts strip under the monitor (dashboard-design.md §4.2).
// PEAK/AVG follow the monitor's active filter; TODAY always comes from the summary API.
export default function Readouts({ now, peak, avg, todayKwh }) {
  const items = [
    { label: "NOW", value: fmtPower(now) },
    { label: "PEAK", value: peak ? `${fmtPower(peak.power_w)} @ ${fmtTime(peak.ts)}` : "–" },
    { label: "AVG", value: fmtPower(avg) },
    { label: "TODAY", value: todayKwh != null ? `${fmtNum(todayKwh, 1)} kWh` : "–" },
  ];

  return (
    <div className="rule-dotted grid grid-cols-2 gap-x-4 gap-y-2 border-b-2 border-dotted border-rule py-3 font-bill text-[11px] uppercase tracking-wide sm:flex sm:flex-wrap sm:items-baseline sm:gap-x-8 sm:gap-y-0">
      {items.map((it) => (
        <p key={it.label} className="truncate">
          <span className="text-ink-soft">{it.label}</span> <span className="text-ink">{it.value}</span>
        </p>
      ))}
    </div>
  );
}
