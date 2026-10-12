"use client";

import { fmtNum, WEATHER_EMOJI } from "@/lib/format";

// 14-day instrument strip (dashboard-design.md §6.1), trimmed to the facts
// that matter at a glance: weekday, sky, high temp, predicted kWh with a thin
// trend bar (scaled to the 14-day max) in place of a separate bar chart. Low
// temp and rain chance moved into the tap-to-expand detail row. Snap-scrolls
// sideways on mobile. `selected` may be null (collapsed, nothing expanded);
// tapping the open tile again closes it (handled by the caller's onSelect).
export default function DayTiles({ days, selected, onSelect, showKwh = true }) {
  const maxKwh = Math.max(1, ...days.map((d) => d.predicted_kwh ?? 0));
  return (
    <div className="scroll-thin -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" role="group" aria-label="Next 14 days">
      {days.map((d, i) => {
        const hot = d.temp_max_c >= 35;
        const active = i === selected;
        const barPct = d.predicted_kwh != null ? Math.max(4, Math.round((d.predicted_kwh / maxKwh) * 100)) : 0;
        return (
          <button
            key={d.date}
            type="button"
            aria-expanded={active}
            aria-controls="day-detail-panel"
            onClick={() => onSelect(i)}
            className={`relative min-w-[92px] shrink-0 snap-start rounded-md border p-3 text-center transition-colors duration-150 ${
              active ? "border-ink bg-paper-dark" : "border-ink/15 hover:border-ink/40"
            }`}
            style={hot ? { boxShadow: "0 0 0 2px rgba(235,104,52,0.4)" } : undefined}
          >
            {hot && (
              <span className="absolute left-1.5 top-1.5 rounded-full bg-ac px-1.5 py-0.5 font-bill text-[9px] uppercase tracking-wide text-white">
                🔥 Hot
              </span>
            )}
            <p className="font-bill text-[10px] uppercase tracking-wide text-ink-soft">{i === 0 ? "Tomorrow" : d.weekday}</p>
            <p className="mt-1 text-2xl" aria-label={d.condition}>
              {WEATHER_EMOJI[d.icon]}
            </p>
            <p className="mt-1 font-bill text-sm text-ac">{Math.round(d.temp_max_c)}°</p>
            {showKwh && (
              <>
                <p className="mt-1.5 font-bill text-base text-usage">
                  {d.predicted_kwh != null ? fmtNum(d.predicted_kwh, 1) : "–"}
                  <span className="ml-0.5 text-[10px] text-ink-soft">kWh</span>
                </p>
                <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-ink/10" aria-hidden>
                  <div className="h-full rounded-full bg-usage" style={{ width: `${barPct}%` }} />
                </div>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}
