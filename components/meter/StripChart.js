"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtDay, fmtNum, fmtWeekdayDay, hourLabel } from "@/lib/format";

// Short label for axis ticks (hour unit) / table-column date (day unit).
export const tickLabel = (unit) => (bucket) => (unit === "hour" ? hourLabel(Number(bucket.slice(11, 13))) : fmtDay(bucket));
// Fuller label for the tooltip and table rows, e.g. "Thu 8 Oct".
export const rowLabel = (unit) => (bucket) => (unit === "hour" ? hourLabel(Number(bucket.slice(11, 13))) : fmtWeekdayDay(bucket));

function SprocketRow() {
  return (
    <div className="flex justify-around px-4" aria-hidden>
      {Array.from({ length: 28 }).map((_, i) => (
        <span key={i} className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--paper)" }} />
      ))}
    </div>
  );
}

function StripTooltip({ active, payload, unit, rate }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  const rs = p.kwh != null && rate != null ? Math.round(p.kwh * rate) : null;
  return (
    <div className="rounded-sm border border-ink bg-paper-dark px-2.5 py-1.5 font-bill text-[11px] text-ink shadow-md">
      {rowLabel(unit)(p.bucket)} · {p.kwh == null ? "not yet" : `${fmtNum(p.kwh, 2)} kWh`}
      {rs != null && ` · ~Rs ${fmtNum(rs)}`}
    </div>
  );
}

// Paper-roll strip chart (dashboard-design.md §5.1): sprocket holes top and
// bottom, a blue pen trace of kWh per bucket. Gaps (kwh == null, e.g. hours
// later today that haven't happened yet) break the line rather than
// connecting across them.
export default function StripChart({ points, unit, rate, height = 260 }) {
  return (
    <div className="rounded-md bg-paper-dark py-2">
      <SprocketRow />
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={points} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--rule)" strokeOpacity={0.5} />
          <XAxis
            dataKey="bucket"
            tickFormatter={tickLabel(unit)}
            tick={{ fill: "var(--ink-soft)", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={14}
          />
          <YAxis tick={{ fill: "var(--ink-soft)", fontSize: 10 }} tickLine={false} axisLine={false} width={34} />
          <Tooltip cursor={{ stroke: "var(--ink)", strokeWidth: 1, strokeDasharray: "3 3" }} content={<StripTooltip unit={unit} rate={rate} />} />
          <Line
            type="monotone"
            dataKey="kwh"
            stroke="var(--ink)"
            strokeWidth={2.5}
            dot={{ r: 2.5, fill: "var(--ink)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            connectNulls={false}
            animationDuration={500}
          />
        </LineChart>
      </ResponsiveContainer>
      <SprocketRow />
    </div>
  );
}
