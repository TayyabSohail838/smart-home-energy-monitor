"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fmtNum, fmtTime } from "@/lib/format";
import { useApi } from "@/lib/useApi";

// Mains voltage under the live monitor: the average per bucket, the 230 V nominal
// line and the high-voltage alert line (GET /api/stats/voltage). Refreshes every 10 s,
// the device's cadence; voltage changes slowly, so no Realtime subscription.

const RANGES = [
  { key: "1h", label: "1 HR" },
  { key: "24h", label: "24 HRS" },
  { key: "week", label: "1 WEEK" },
];
const NOMINAL_V = 230;
const LINE = "var(--lamp-amber)";

const xTick = (range) => (v) =>
  range === "week"
    ? new Date(v).toLocaleDateString("en-US", { timeZone: "Asia/Karachi", weekday: "short" })
    : fmtTime(new Date(v).toISOString());

function VoltTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md bg-screen px-2.5 py-1.5 font-bill text-[11px] text-screen-text shadow-lg ring-1 ring-white/10">
      {fmtTime(new Date(p.t).toISOString())} · {fmtNum(p.avg, 1)} V
      {p.max - p.avg >= 1 && ` · max ${fmtNum(p.max, 0)} V`}
    </div>
  );
}

export default function VoltageMonitor() {
  const [range, setRange] = useState("24h");
  const { data, error } = useApi(`/api/stats/voltage?range=${range}`, { refreshMs: 10_000 });

  const limit = data?.high_voltage_v ?? 250;
  const points = (data?.points ?? []).map((p) => ({ t: Date.parse(p.ts), avg: p.avg_voltage_v, max: p.max_voltage_v }));
  const latest = data?.latest?.voltage_v ?? null;
  const high = latest != null && latest > limit;
  const peak = data?.max_voltage_v ?? null;
  const lo = Math.min(200, ...points.map((p) => p.avg)) - 5;
  const hi = Math.max(limit + 10, ...points.map((p) => p.max)) + 5;

  return (
    <div className="mt-4 rounded-md bg-screen p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-baseline gap-3 font-bill uppercase tracking-wide">
          <span className="text-[11px] text-screen-text/60">Mains voltage</span>
          {latest != null && (
            <>
              <span className="text-lg text-screen-text">{fmtNum(latest, 0)} V</span>
              <span className="text-[11px]" style={{ color: high ? "var(--lamp-red)" : "var(--lamp-green, #3fb27f)" }}>
                {high ? `⚠ High (over ${limit} V)` : "✓ Normal"}
              </span>
            </>
          )}
          {peak != null && <span className="text-[11px] text-screen-text/50">Peak {fmtNum(peak, 0)} V</span>}
        </div>
        <div role="radiogroup" aria-label="Voltage time range" className="inline-flex gap-1 rounded-md bg-black/30 p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={r.key === range}
              onClick={() => setRange(r.key)}
              className={`rounded-[4px] px-2.5 py-1 font-bill text-[11px] uppercase tracking-wide transition-colors duration-150 ${
                r.key === range ? "bg-breaker-on text-paper" : "text-white/50 hover:text-white/80"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="py-10 text-center font-bill text-xs uppercase tracking-wide text-screen-text/40">Voltage unavailable</p>
      ) : data && points.length === 0 ? (
        <div className="grid h-[160px] place-items-center border-y border-dashed border-white/10">
          <p className="max-w-md text-center font-bill text-xs uppercase leading-relaxed tracking-wide text-screen-text/40">
            No voltage readings in this window yet
          </p>
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--screen-grid)" vertical={false} />
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={["dataMin", "dataMax"]}
              tickFormatter={xTick(range)}
              tick={{ fill: "rgba(217,225,220,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={40}
            />
            <YAxis
              domain={[Math.floor(lo), Math.ceil(hi)]}
              tickFormatter={(v) => `${v} V`}
              tick={{ fill: "rgba(217,225,220,0.5)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={52}
            />
            <ReferenceLine y={NOMINAL_V} stroke="rgba(217,225,220,0.35)" strokeDasharray="2 4"
              label={{ value: "230 V normal", position: "insideBottomLeft", fill: "rgba(217,225,220,0.5)", fontSize: 10 }} />
            <ReferenceLine y={limit} stroke="var(--lamp-red)" strokeDasharray="4 4"
              label={{ value: `${limit} V alert`, position: "insideTopLeft", fill: "var(--lamp-red)", fontSize: 10 }} />
            <Tooltip content={<VoltTooltip />} cursor={{ stroke: "rgba(255,255,255,0.2)" }} />
            <Line type="monotone" dataKey="avg" stroke={LINE} strokeWidth={2} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
