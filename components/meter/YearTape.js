"use client";

import { Bar, ComposedChart, ErrorBar, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum, fmtRs } from "@/lib/format";

// Slab tint: lighter for a lower predicted slab, deeper for a higher one
// (dashboard-design.md §6.2), ranked across whichever slabs actually appear
// in the fetched months (never the full tariff table, so "lowest shown" is
// never drawn as if it were the cheapest slab on the bill).
function slabOpacity(months) {
  const order = [...new Set(months.map((m) => m.predicted_slab))].sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
  return (slab) => (order.length <= 1 ? 0.8 : 0.4 + (order.indexOf(slab) / (order.length - 1)) * 0.55);
}

function HatchDefs() {
  return (
    <defs>
      <pattern id="yeartape-hatch" width="5" height="5" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
        <rect width="5" height="5" fill="var(--usage-blue)" fillOpacity="0.18" />
        <line x1="0" y1="0" x2="0" y2="5" stroke="var(--usage-blue)" strokeWidth="2" />
      </pattern>
    </defs>
  );
}

// Solid for a seasonal-forecast month, a hatched top strip for "mixed", fully
// hatched (+ a NORMALS label) for a 5-year-normals month (dashboard-design.md §6.2).
// `active` outlines the selected month in ink, same as the old per-chart "selected" dimming.
function MonthBar({ x, y, width, height, payload, opacityFor, active }) {
  const opacity = opacityFor(payload.predicted_slab);
  const outline = active ? { stroke: "var(--ink)", strokeWidth: 1.5 } : {};
  if (payload.weather_basis === "forecast") {
    return <rect x={x} y={y} width={width} height={height} fill="var(--usage-blue)" fillOpacity={opacity} rx={2} {...outline} />;
  }
  if (payload.weather_basis === "mixed") {
    const hatchH = Math.min(height, height * 0.3);
    return (
      <g>
        <rect x={x} y={y + hatchH} width={width} height={Math.max(0, height - hatchH)} fill="var(--usage-blue)" fillOpacity={opacity} {...outline} />
        <rect x={x} y={y} width={width} height={hatchH} fill="url(#yeartape-hatch)" fillOpacity={opacity} />
      </g>
    );
  }
  return (
    <g>
      <rect x={x} y={y} width={width} height={height} fill="url(#yeartape-hatch)" fillOpacity={opacity} {...outline} />
      <text x={x + width / 2} y={y - 4} textAnchor="middle" fontSize="7" className="font-bill" fill="var(--ink-soft)">
        NORMALS
      </text>
    </g>
  );
}

function YearTapeTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const m = payload[0].payload;
  return (
    <div className="rounded-sm border border-ink bg-paper-dark px-2.5 py-1.5 font-bill text-[11px] text-ink shadow-md">
      {m.month.slice(0, 3)} {m.year} · {fmtNum(m.forecast_temp_c, 0)}° · {fmtNum(m.predicted_kwh)} kWh · {fmtRs(m.predicted_bill)} · slab {m.predicted_slab}
    </div>
  );
}

// The year tape (dashboard-design.md §6.2): blue bars = predicted kWh,
// tinted by slab; an orange line = forecast temperature on a second axis,
// with a whisker for the likely range when the seasonal model gives one.
export default function YearTape({ months, selected, onSelect, height = 260 }) {
  const opacityFor = slabOpacity(months);
  const data = months.map((m, i) => ({
    ...m,
    i,
    label: `${m.month.slice(0, 3)}${m.month === "January" ? ` '${String(m.year).slice(2)}` : ""}`,
    range: m.likely_range_c ? [m.forecast_temp_c - m.likely_range_c[0], m.likely_range_c[1] - m.forecast_temp_c] : null,
  }));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart
        data={data}
        margin={{ top: 16, right: 12, left: -8, bottom: 0 }}
        onClick={(e) => e?.activeTooltipIndex != null && onSelect?.(Number(e.activeTooltipIndex))}
        style={{ cursor: "pointer" }}
      >
        <HatchDefs />
        <XAxis dataKey="label" tick={{ fill: "var(--ink-soft)", fontSize: 10 }} tickLine={false} axisLine={false} interval={0} />
        <YAxis yAxisId="kwh" tick={{ fill: "var(--ink-soft)", fontSize: 10 }} tickLine={false} axisLine={false} width={38} />
        <YAxis
          yAxisId="temp"
          orientation="right"
          domain={[0, 45]}
          unit="°"
          tick={{ fill: "var(--ac-orange)", fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          width={28}
        />
        <Tooltip content={<YearTapeTooltip />} cursor={{ fill: "rgba(27,26,23,0.05)" }} />
        <Bar
          yAxisId="kwh"
          dataKey="predicted_kwh"
          shape={(props) => <MonthBar {...props} opacityFor={opacityFor} active={props.payload.i === selected} />}
          isAnimationActive={false}
        />
        <Line
          yAxisId="temp"
          type="monotone"
          dataKey="forecast_temp_c"
          stroke="var(--ac-orange)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--ac-orange)" }}
          isAnimationActive={false}
        >
          <ErrorBar dataKey="range" width={4} strokeWidth={1.5} stroke="var(--ac-orange)" />
        </Line>
      </ComposedChart>
    </ResponsiveContainer>
  );
}
