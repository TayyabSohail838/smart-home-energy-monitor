"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
// bottom, ink bars with a blue top cap. The cap is a fixed share of the
// tallest bar rather than a fixed pixel height - Recharts stacks by value,
// not pixels - so it reads as a consistent strip across every bar instead of
// scaling with each bar's own height.
export default function StripChart({ points, unit, rate, height = 260 }) {
  const maxKwh = Math.max(0, ...points.map((p) => p.kwh ?? 0));
  const cap = maxKwh * 0.035;
  const data = points.map((p) => ({
    ...p,
    body: p.kwh == null ? null : Math.max(0, p.kwh - cap),
    cap: p.kwh == null ? null : Math.min(p.kwh, cap),
  }));

  return (
    <div className="rounded-md bg-paper-dark py-2">
      <SprocketRow />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 12, left: -8, bottom: 0 }} barCategoryGap="22%">
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
          <Tooltip cursor={{ fill: "rgba(27,26,23,0.05)" }} content={<StripTooltip unit={unit} rate={rate} />} />
          <Bar dataKey="body" stackId="u" fill="var(--ink)" animationDuration={500} />
          <Bar dataKey="cap" stackId="u" fill="var(--usage-blue)" radius={[2, 2, 0, 0]} animationDuration={500} />
        </BarChart>
      </ResponsiveContainer>
      <SprocketRow />
    </div>
  );
}
