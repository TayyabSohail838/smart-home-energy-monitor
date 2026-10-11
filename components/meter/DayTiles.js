"use client";

import { fmtNum, WEATHER_EMOJI } from "@/lib/format";

// 14-day instrument strip (dashboard-design.md §6.1). Snap-scrolls sideways on
// mobile. The selected tile (default: the nearest day) is outlined in ink -
// there is no literal "today" tile, since next_days starts tomorrow.
export default function DayTiles({ days, selected, onSelect }) {
  return (
    <div className="scroll-thin -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2" role="listbox" aria-label="Next 14 days">
      {days.map((d, i) => {
        const hot = d.temp_max_c >= 35;
        const active = i === selected;
        return (
          <button
            key={d.date}
            type="button"
            role="option"
            aria-selected={active}
            onClick={() => onSelect(i)}
            className={`relative min-w-[104px] shrink-0 snap-start rounded-md border p-3 text-center transition-colors duration-150 ${
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
            <p className="mt-1 font-bill text-sm text-ac">
              {Math.round(d.temp_max_c)}° <span className="text-ink-soft">{Math.round(d.temp_min_c)}°</span>
            </p>
            <p className="font-bill text-[10px] text-ink-soft">💧 {d.rain_chance_pct ?? 0}%</p>
            <p className="mt-1.5 font-bill text-base text-usage">
              {d.predicted_kwh != null ? fmtNum(d.predicted_kwh, 1) : "–"}
              <span className="ml-0.5 text-[10px] text-ink-soft">kWh</span>
            </p>
          </button>
        );
      })}
    </div>
  );
}
