"use client";

import { fmtW, hourLabel } from "@/lib/format";
import { useNow } from "@/lib/useNow";

const CX = 100;
const CY = 100;
const R_MIN = 16;
const R_MAX = 86;
const PKT_OFFSET_MS = 5 * 3600 * 1000; // Asia/Karachi is UTC+5 all year

// Hour 0 (12am) at the top, clockwise - 24 positions around the full circle,
// not a 12-hour analogue face.
const angleFor = (hour) => 270 + hour * 15;
const point = (angleDeg, radius) => {
  const rad = (angleDeg * Math.PI) / 180;
  return [CX + radius * Math.cos(rad), CY + radius * Math.sin(rad)];
};

// 24-hour radial clock (dashboard-design.md §5.3): one ray per hour, length
// proportional to that hour's average power. The top 3 ranked hours (from
// getPeakHours(), already sorted) are orange; the rest are blue at lower
// opacity. A thin needle marks the current hour.
export default function PeakClock({ hours, topHours, message }) {
  const now = useNow(60_000);

  const maxAvg = Math.max(1, ...hours.map((h) => h.avg_power_w));
  const top3 = new Set(topHours);
  const currentHour = now ? new Date(now + PKT_OFFSET_MS).getUTCHours() : null;

  const top1 = topHours.length ? hours.find((h) => h.hour === topHours[0]) : null;
  const readout = top1
    ? `Your home works hardest at ${hourLabel(top1.hour)} (avg ${fmtW(top1.avg_power_w)}). Top hours: ${topHours.map(hourLabel).join(", ")}.`
    : message;

  return (
    <div>
      <svg viewBox="0 0 200 200" className="mx-auto w-full max-w-[280px]" role="img" aria-label={readout}>
        {hours.map((h) => {
          const angle = angleFor(h.hour);
          const len = R_MIN + (h.avg_power_w / maxAvg) * (R_MAX - R_MIN);
          const [x, y] = point(angle, len);
          const [x0, y0] = point(angle, R_MIN);
          const isTop = top3.has(h.hour);
          return (
            <line
              key={h.hour}
              x1={x0}
              y1={y0}
              x2={x}
              y2={y}
              stroke={isTop ? "var(--ac-orange)" : "var(--usage-blue)"}
              strokeOpacity={isTop ? 1 : 0.45}
              strokeWidth={isTop ? 3 : 2}
              strokeLinecap="round"
            />
          );
        })}

        {topHours.map((hh) => {
          const h = hours.find((x) => x.hour === hh);
          const [lx, ly] = point(angleFor(hh), R_MAX + 14);
          return (
            <text key={hh} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle" fontSize="7" className="font-bill" fill="var(--ink)">
              {hourLabel(hh)} · {fmtW(h.avg_power_w)}
            </text>
          );
        })}

        {currentHour != null && (
          <line
            x1={CX}
            y1={CY}
            x2={point(angleFor(currentHour), R_MIN + 4)[0]}
            y2={point(angleFor(currentHour), R_MIN + 4)[1]}
            stroke="var(--ink)"
            strokeWidth="1.5"
          />
        )}
        <circle cx={CX} cy={CY} r="3" fill="var(--ink)" />

        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="9" className="font-bill" fill="var(--ink-soft)">
          PEAK
        </text>
        <text x={CX} y={CY + 7} textAnchor="middle" fontSize="11" className="font-bill" fill="var(--ink)">
          {top1 ? hourLabel(top1.hour) : "–"}
        </text>
      </svg>

      <p className="mt-3 text-center text-sm leading-relaxed text-ink-soft">{readout}</p>

      <ul className="sr-only">
        {hours.map((h) => (
          <li key={h.hour}>
            {hourLabel(h.hour)}: {fmtW(h.avg_power_w)} average{h.samples === 0 ? ", no data" : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
