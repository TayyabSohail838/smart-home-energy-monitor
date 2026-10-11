"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtDay, fmtNum, fmtRs, fmtTime, hourLabel } from "@/lib/format";

// Chart roles (see globals.css; validated reference palette, light mode).
const C = {
  s1: "#2a78d6",
  s1Soft: "#9ec5f4",
  s2: "#eb6834",
  grid: "#e1e0d9",
  axis: "#898781",
  ink: "#14161a",
};

const axisProps = {
  tick: { fill: C.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
};

// Short y-axis labels: 1800 -> "1.8k"; small values keep enough decimals to stay distinct.
function yTick(max) {
  return (v) => (v >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v, max < 1 ? 2 : max < 10 ? 1 : 0));
}

function TooltipBox({ title, rows }) {
  return (
    <div className="glass-strong rounded-2xl px-3 py-2 text-xs">
      <p className="mb-1 font-medium text-ink">{title}</p>
      {rows.map((r) => (
        <p key={r.label} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-medium tabular-nums text-ink">{r.value}</span>
        </p>
      ))}
    </div>
  );
}

function Legend({ items }) {
  return (
    <div className="mb-2 flex flex-wrap gap-4 text-xs text-ink-2">
      {items.map((i) => (
        <span key={i.label} className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: i.color }} />
          {i.label}
        </span>
      ))}
    </div>
  );
}

// ---------- Live power (last ~10 minutes) ----------
export function LivePowerChart({ points, height = 140 }) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={points} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="liveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.s1} stopOpacity={0.28} />
            <stop offset="100%" stopColor={C.s1} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="ts" hide />
        <YAxis hide domain={[0, (max) => Math.max(100, max * 1.2)]} />
        <Tooltip
          cursor={{ stroke: C.axis, strokeDasharray: "3 3" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={fmtTime(payload[0].payload.ts)}
                rows={[
                  { label: "Power", value: `${fmtNum(payload[0].payload.power_w)} W` },
                  { label: "Current", value: `${fmtNum(payload[0].payload.current_a, 2)} A` },
                ]}
              />
            ) : null
          }
        />
        <Area
          type="monotone"
          dataKey="power_w"
          stroke={C.s1}
          strokeWidth={2}
          fill="url(#liveFill)"
          isAnimationActive={false}
          activeDot={{ r: 4, stroke: "#fff", strokeWidth: 2 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ---------- Usage history (kWh per hour or per day) ----------
export function UsageBars({ points, unit, height = 260 }) {
  const data = points.map((p) => ({
    ...p,
    label: unit === "hour" ? hourLabel(Number(p.bucket.slice(11, 13))) : fmtDay(p.bucket),
  }));
  const max = Math.max(...data.map((d) => d.kwh ?? 0));

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }} barCategoryGap="18%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval="preserveStartEnd" minTickGap={14} />
        <YAxis {...axisProps} width={48} tickFormatter={yTick(max)} />
        <Tooltip
          cursor={{ fill: "rgba(20,22,26,0.04)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={unit === "hour" ? `${payload[0].payload.bucket.slice(0, 10)} · ${payload[0].payload.label}` : payload[0].payload.bucket}
                rows={[{ label: "Energy", value: payload[0].payload.kwh == null ? "not yet" : `${fmtNum(payload[0].payload.kwh, 2)} kWh` }]}
              />
            ) : null
          }
        />
        <Bar dataKey="kwh" fill={C.s1} radius={[4, 4, 0, 0]} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- Peak hours (24 bars, top 3 emphasised) ----------
export function PeakHoursChart({ hours, top, height = 240 }) {
  const data = hours.map((h) => ({ ...h, label: hourLabel(h.hour), peak: top.includes(h.hour) }));
  return (
    <>
      <Legend items={[{ label: "Peak hour (top 3)", color: C.s1 }, { label: "Other hours", color: C.s1Soft }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="14%">
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} interval={2} />
          <YAxis {...axisProps} width={48} tickFormatter={yTick(2000)} />
          <Tooltip
            cursor={{ fill: "rgba(20,22,26,0.04)" }}
            content={({ active, payload }) =>
              active && payload?.length ? (
                <TooltipBox
                  title={`${payload[0].payload.label}${payload[0].payload.peak ? " · peak" : ""}`}
                  rows={[{ label: "Average power", value: `${fmtNum(payload[0].payload.avg_power_w)} W` }]}
                />
              ) : null
            }
          />
          <Bar dataKey="avg_power_w" radius={[4, 4, 0, 0]} animationDuration={800}>
            {data.map((d) => (
              <Cell key={d.hour} fill={d.peak ? C.s1 : C.s1Soft} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

// ---------- Next 14 days: predicted kWh ----------
export function DailyForecastChart({ days, height = 180 }) {
  const data = days.map((d) => ({ ...d, label: `${d.weekday} ${fmtDay(d.date).split(" ")[0]}` }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval={1} />
        <YAxis {...axisProps} width={44} />
        <Tooltip
          cursor={{ fill: "rgba(20,22,26,0.04)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={`${payload[0].payload.weekday}, ${fmtDay(payload[0].payload.date)} · ${payload[0].payload.condition}`}
                rows={[
                  { label: "Predicted use", value: `${fmtNum(payload[0].payload.predicted_kwh, 1)} kWh` },
                  { label: "High / low", value: `${fmtNum(payload[0].payload.temp_max_c)}° / ${fmtNum(payload[0].payload.temp_min_c)}°` },
                ]}
              />
            ) : null
          }
        />
        <Bar dataKey="predicted_kwh" fill={C.s1} radius={[4, 4, 0, 0]} animationDuration={700} />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- 12 months: units, split into base load and AC estimate (stacked) ----------
export function YearUsageChart({ months, selected, onSelect, height = 280 }) {
  const data = months.map((m, i) => ({
    i,
    label: `${m.month.slice(0, 3)}${m.month === "January" || i === 0 ? ` ’${String(m.year).slice(2)}` : ""}`,
    base: Math.max(0, m.predicted_kwh - m.ac_kwh_est),
    ac: m.ac_kwh_est,
    m,
  }));
  const dim = (i) => (selected == null || selected === i ? 1 : 0.35);

  return (
    <>
      <Legend items={[{ label: "Base load", color: C.s1 }, { label: "AC (est.)", color: C.s2 }]} />
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 8, right: 4, left: -12, bottom: 0 }}
          barCategoryGap="22%"
          onClick={(e) => e?.activeTooltipIndex != null && onSelect?.(Number(e.activeTooltipIndex))}
          style={{ cursor: "pointer" }}
        >
          <CartesianGrid vertical={false} stroke={C.grid} />
          <XAxis dataKey="label" {...axisProps} interval={0} />
          <YAxis {...axisProps} width={48} tickFormatter={yTick(1000)} />
          <Tooltip
            cursor={{ fill: "rgba(20,22,26,0.04)" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const { m } = payload[0].payload;
              return (
                <TooltipBox
                  title={`${m.month} ${m.year} · ${m.season}`}
                  rows={[
                    { label: "Base load", value: `${fmtNum(m.predicted_kwh - m.ac_kwh_est)} kWh`, color: C.s1 },
                    { label: "AC (est.)", value: `${fmtNum(m.ac_kwh_est)} kWh`, color: C.s2 },
                    { label: "Bill (energy)", value: fmtRs(m.predicted_bill) },
                  ]}
                />
              );
            }}
          />
          <Bar dataKey="base" stackId="u" fill={C.s1} animationDuration={800}>
            {data.map((d) => <Cell key={d.i} fillOpacity={dim(d.i)} />)}
          </Bar>
          <Bar dataKey="ac" stackId="u" fill={C.s2} radius={[4, 4, 0, 0]} animationDuration={800}>
            {data.map((d) => <Cell key={d.i} fillOpacity={dim(d.i)} stroke="#fcfcfb" strokeWidth={d.ac > 0 ? 2 : 0} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </>
  );
}

// ---------- 12 months: temperature range (avg low → avg high) ----------
export function TempRangeChart({ months, selected, onSelect, height = 220 }) {
  const data = months.map((m, i) => ({ i, label: m.month.slice(0, 3), range: [m.avg_low_c, m.avg_high_c], m }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 4, left: -18, bottom: 0 }}
        barCategoryGap="30%"
        onClick={(e) => e?.activeTooltipIndex != null && onSelect?.(Number(e.activeTooltipIndex))}
        style={{ cursor: "pointer" }}
      >
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval={0} />
        <YAxis {...axisProps} width={44} unit="°" domain={[0, 45]} />
        <Tooltip
          cursor={{ fill: "rgba(20,22,26,0.04)" }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const { m } = payload[0].payload;
            return (
              <TooltipBox
                title={`${m.month} ${m.year}`}
                rows={[
                  { label: "Avg high", value: `${fmtNum(m.avg_high_c, 1)} °C` },
                  { label: "Avg low", value: `${fmtNum(m.avg_low_c, 1)} °C` },
                  { label: "Rain", value: `${fmtNum(m.rain_mm)} mm · ${m.rainy_days} days` },
                ]}
              />
            );
          }}
        />
        <Bar dataKey="range" fill={C.s2} radius={[4, 4, 4, 4]} animationDuration={800}>
          {data.map((d) => <Cell key={d.i} fillOpacity={selected == null || selected === d.i ? 1 : 0.35} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ---------- 12 months: rainfall ----------
export function RainChart({ months, height = 160 }) {
  const data = months.map((m) => ({ label: m.month.slice(0, 3), rain: m.rain_mm, m }));
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap="30%">
        <CartesianGrid vertical={false} stroke={C.grid} />
        <XAxis dataKey="label" {...axisProps} interval={0} />
        <YAxis {...axisProps} width={44} />
        <Tooltip
          cursor={{ fill: "rgba(20,22,26,0.04)" }}
          content={({ active, payload }) =>
            active && payload?.length ? (
              <TooltipBox
                title={`${payload[0].payload.m.month} ${payload[0].payload.m.year}`}
                rows={[{ label: "Rain", value: `${fmtNum(payload[0].payload.rain)} mm` }]}
              />
            ) : null
          }
        />
        <Bar dataKey="rain" fill={C.s1} radius={[4, 4, 0, 0]} animationDuration={800} />
      </BarChart>
    </ResponsiveContainer>
  );
}
