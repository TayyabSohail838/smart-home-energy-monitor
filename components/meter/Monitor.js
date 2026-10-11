"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceArea,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtNum, fmtTime } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useNow } from "@/lib/useNow";

// The Overview's "heart monitor" (dashboard-design.md §4.1). Loads a bucketed
// window from GET /api/stats/live, then keeps it live from Supabase Realtime:
// 1 HR appends each raw reading, 24 HRS/1 WEEK fold each reading into a running
// average for whichever bucket it lands in. The bucket math mirrors the SQL
// function's date_bin('epoch') origin, so a live point lines up with the ones
// the next fetch would have produced.

const RANGE = {
  "1h": { label: "1 HR", api: "1h", spanMs: 3600_000, bucketMs: 10_000 },
  "24h": { label: "24 HRS", api: "24h", spanMs: 86_400_000, bucketMs: 300_000 },
  week: { label: "1 WEEK", api: "week", spanMs: 7 * 86_400_000, bucketMs: 3_600_000 },
};
const ORDER = ["1h", "24h", "week"];
const PKT_OFFSET_MS = 5 * 3600 * 1000; // Asia/Karachi is UTC+5 all year
const STALE_MS = 30_000;

// Assumed prior readings already folded into a fetched bucket (~10s device
// cadence), so one new live reading nudges a 5-minute/1-hour bucket instead of
// swinging it to the new reading's value alone.
const weightFor = (bucketMs) => Math.max(1, Math.round(bucketMs / 10_000));

// 10pm-6am Asia/Karachi bands (as real UTC ms) overlapping [minMs, maxMs].
function nightBands(minMs, maxMs) {
  const bands = [];
  const startDay = Math.floor((minMs + PKT_OFFSET_MS) / 86_400_000) - 1;
  const endDay = Math.floor((maxMs + PKT_OFFSET_MS) / 86_400_000) + 1;
  for (let d = startDay; d <= endDay; d++) {
    const dayStartShifted = d * 86_400_000;
    const start = dayStartShifted + 22 * 3_600_000 - PKT_OFFSET_MS;
    const end = dayStartShifted + 30 * 3_600_000 - PKT_OFFSET_MS;
    if (end > minMs && start < maxMs) bands.push({ start: Math.max(start, minMs), end: Math.min(end, maxMs) });
  }
  return bands;
}

const yTick = (max) => (v) => (max >= 1000 ? `${fmtNum(v / 1000, 1)}k` : fmtNum(v));
const xTick = (range) => (v) =>
  range === "week"
    ? new Date(v).toLocaleDateString("en-US", { timeZone: "Asia/Karachi", weekday: "short" })
    : fmtTime(new Date(v).toISOString());

function MonitorTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-md bg-screen px-2.5 py-1.5 font-bill text-[11px] text-screen-text shadow-lg ring-1 ring-white/10">
      {fmtTime(p.ts)} · {fmtNum(p.y)} W
    </div>
  );
}

// The live tip: a dot that pulses once per reading, at the end of the trace.
function PulseDot({ cx, cy }) {
  if (cx == null || cy == null) return null;
  return (
    <g aria-hidden>
      <circle
        cx={cx}
        cy={cy}
        r={7}
        fill="var(--trace)"
        opacity={0.35}
        className="animate-ping-soft"
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      />
      <circle cx={cx} cy={cy} r={3.5} fill="var(--trace)" stroke="var(--screen)" strokeWidth={1.5} />
    </g>
  );
}

// An anomaly marker on the trace; tap/click goes to the logbook (dashboard-design.md §7).
function SpikeMark({ cx, cy, alert, router }) {
  if (cx == null || cy == null) return null;
  return (
    <g style={{ cursor: "pointer" }} onClick={() => router.push("/alerts")}>
      <title>{`⚠ ${alert.message} · ${fmtTime(alert.ts)}`}</title>
      <path d={`M ${cx} ${cy - 10} L ${cx - 5} ${cy - 1} L ${cx + 5} ${cy - 1} Z`} fill="var(--lamp-red)" />
    </g>
  );
}

function Filters({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Time range" className="inline-flex gap-1 rounded-md bg-black/30 p-1">
      {ORDER.map((key) => {
        const active = key === value;
        return (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(key)}
            className={`rounded-[4px] px-2.5 py-1 font-bill text-[11px] uppercase tracking-wide transition-colors duration-150 ${
              active ? "bg-breaker-on text-paper" : "text-white/50 hover:text-white/80"
            }`}
          >
            {RANGE[key].label}
          </button>
        );
      })}
    </div>
  );
}

export default function Monitor({ deviceId, alerts, onReading, onStats }) {
  const router = useRouter();
  const [range, setRange] = useState("24h");
  const [points, setPoints] = useState([]);
  const [peak, setPeak] = useState(null);
  const [latest, setLatest] = useState(null);
  const [status, setStatus] = useState("connecting");
  const [loading, setLoading] = useState(true);
  const bucketsRef = useRef(new Map());
  const cfg = RANGE[range];
  const cfgRef = useRef(cfg);
  useEffect(() => {
    cfgRef.current = cfg;
  }, [cfg]);
  const now = useNow(15_000);

  const onReadingRef = useRef(onReading);
  useEffect(() => {
    onReadingRef.current = onReading;
  }, [onReading]);
  const onStatsRef = useRef(onStats);
  useEffect(() => {
    onStatsRef.current = onStats;
  }, [onStats]);

  // Fresh load whenever the filter changes. The previous range's points stay
  // on screen until this resolves (same "keep old data" rule as useApi.js),
  // so switching filters doesn't flash NO SIGNAL for a moment.
  useEffect(() => {
    let cancelled = false;
    bucketsRef.current = new Map();
    (async () => {
      try {
        const res = await fetch(`/api/stats/live?range=${cfg.api}`, { cache: "no-store" });
        const body = await res.json();
        if (cancelled) return;
        const w = weightFor(cfg.bucketMs);
        for (const p of body.points ?? []) {
          bucketsRef.current.set(Date.parse(p.ts), { sum: p.power_w * w, count: w });
        }
        setPoints(body.points ?? []);
        setPeak(body.peak ?? null);
        setLoading(false);
      } catch {
        if (!cancelled) {
          setPoints([]);
          setPeak(null);
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cfg.api, cfg.bucketMs]);

  // One subscription for the component's life; the handler always reads the
  // current filter through cfgRef so switching filters doesn't resubscribe.
  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`monitor:${deviceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings", filter: `device_id=eq.${deviceId}` },
        ({ new: row }) => {
          setLatest(row);
          onReadingRef.current?.(row);

          const { bucketMs, spanMs } = cfgRef.current;
          const tsMs = Date.parse(row.ts);
          const bucketStart = Math.floor(tsMs / bucketMs) * bucketMs;
          const prev = bucketsRef.current.get(bucketStart) ?? { sum: 0, count: 0 };
          const next = { sum: prev.sum + row.power_w, count: prev.count + 1 };
          bucketsRef.current.set(bucketStart, next);
          const avg = next.sum / next.count;
          const bucketIso = new Date(bucketStart).toISOString();

          setPoints((pts) => {
            const cutoff = tsMs - spanMs;
            const kept = pts.filter((p) => Date.parse(p.ts) >= cutoff);
            const last = kept.at(-1);
            if (last && Date.parse(last.ts) === bucketStart) {
              return [...kept.slice(0, -1), { ts: bucketIso, power_w: avg }];
            }
            return [...kept, { ts: bucketIso, power_w: avg }];
          });

          setPeak((p) => (!p || row.power_w > p.power_w ? { power_w: row.power_w, ts: row.ts } : p));
        }
      )
      .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "subscribed" : s.toLowerCase()));

    return () => supabase.removeChannel(channel);
  }, [deviceId]);

  const chartData = useMemo(() => points.map((p) => ({ x: Date.parse(p.ts), y: p.power_w, ts: p.ts })), [points]);
  const maxY = Math.max(100, ...chartData.map((d) => d.y));
  const domain = useMemo(() => (chartData.length ? [chartData[0].x, chartData.at(-1).x] : null), [chartData]);
  const bands = useMemo(() => (domain && range !== "1h" ? nightBands(domain[0], domain[1]) : []), [domain, range]);
  const visibleSpikes = useMemo(() => {
    if (!domain) return [];
    return (alerts ?? []).filter(
      (a) => a.type === "anomaly" && Date.parse(a.ts) >= domain[0] && Date.parse(a.ts) <= domain[1]
    );
  }, [alerts, domain]);
  const avgDisplay = chartData.length ? chartData.reduce((s, d) => s + d.y, 0) / chartData.length : null;
  const nowW = latest?.power_w ?? chartData.at(-1)?.y ?? null;
  const lastReadingTs = latest?.ts ?? chartData.at(-1)?.ts ?? null;
  const live = Boolean(latest && now && now - Date.parse(latest.ts) < STALE_MS);

  // Lifted to the Overview page: Readouts sits under both the monitor and the
  // status lights column, and the DEVICE lamp needs the last reading time
  // without a second realtime subscription.
  useEffect(() => {
    onStatsRef.current?.({ now: nowW, peak, avg: avgDisplay, lastReadingTs });
  }, [nowW, peak, avgDisplay, lastReadingTs]);

  return (
    <div className="rounded-md bg-screen p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className="flex items-center gap-2 font-bill text-[11px] uppercase tracking-wide text-screen-text/60">
          <span className="live-dot" data-state={live ? "live" : "stale"} />
          {live ? "Live" : status === "subscribed" ? "Waiting for device" : "Connecting…"}
        </span>
        <Filters value={range} onChange={setRange} />
      </div>

      <div className="trace-glow">
        {!loading && chartData.length === 0 ? (
          <div className="grid h-[220px] place-items-center border-y border-dashed border-white/10 sm:h-[300px]">
            <p className="font-bill text-xs uppercase tracking-wide text-screen-text/40">
              NO SIGNAL · waiting for first reading
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="traceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--trace)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--trace)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--screen-grid)" strokeOpacity={0.7} vertical={false} />
              {bands.map((b, i) => (
                <ReferenceArea key={i} x1={b.start} x2={b.end} fill="#000" fillOpacity={0.22} ifOverflow="hidden" />
              ))}
              <XAxis
                dataKey="x"
                type="number"
                domain={domain ?? ["auto", "auto"]}
                tickFormatter={xTick(range)}
                tick={{ fill: "var(--screen-text)", fontSize: 10, opacity: 0.6 }}
                tickLine={false}
                axisLine={false}
                minTickGap={40}
              />
              <YAxis
                domain={[0, maxY * 1.15]}
                tickFormatter={yTick(maxY)}
                tick={{ fill: "var(--screen-text)", fontSize: 10, opacity: 0.6 }}
                tickLine={false}
                axisLine={false}
                width={38}
              />
              <Tooltip cursor={{ stroke: "var(--screen-text)", strokeOpacity: 0.3 }} content={<MonitorTooltip />} />
              <Area
                type="monotone"
                dataKey="y"
                stroke="var(--trace)"
                strokeWidth={2}
                fill="url(#traceFill)"
                isAnimationActive={false}
                dot={false}
                activeDot={{ r: 3, fill: "var(--trace)", stroke: "var(--screen)" }}
              />
              {chartData.length > 0 && (
                <ReferenceDot
                  x={chartData.at(-1).x}
                  y={chartData.at(-1).y}
                  r={0}
                  shape={PulseDot}
                  ifOverflow="extendDomain"
                />
              )}
              {visibleSpikes.map((a) => (
                <ReferenceDot
                  key={a.id}
                  x={Date.parse(a.ts)}
                  y={a.power_w ?? maxY}
                  r={0}
                  shape={(props) => <SpikeMark {...props} alert={a} router={router} />}
                  ifOverflow="extendDomain"
                />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
