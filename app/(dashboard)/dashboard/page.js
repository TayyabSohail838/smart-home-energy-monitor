"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import AlertBanner from "@/components/AlertBanner";
import AlertTicker from "@/components/meter/AlertTicker";
import BillSlip from "@/components/meter/BillSlip";
import Monitor from "@/components/meter/Monitor";
import Readouts from "@/components/meter/Readouts";
import SlabDial from "@/components/meter/SlabDial";
import StatusLights from "@/components/meter/StatusLights";
import StripChart from "@/components/meter/StripChart";
import UnitsCounter from "@/components/meter/UnitsCounter";
import VoltageMonitor from "@/components/meter/VoltageMonitor";
import { useDevice } from "@/components/Shell";
import { ErrorNote } from "@/components/ui";
import { fmtNum, hourLabel, WEATHER_EMOJI } from "@/lib/format";
import { useApi } from "@/lib/useApi";
import { useNow } from "@/lib/useNow";

const PKT_OFFSET_MS = 5 * 3600 * 1000; // Asia/Karachi is UTC+5 all year
const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// "Good evening · Sun 11 Oct" (dashboard-design.md §4.6), by Asia/Karachi time.
function greeting(nowMs) {
  if (!nowMs) return null;
  const d = new Date(nowMs + PKT_OFFSET_MS);
  const hour = d.getUTCHours();
  const phase = hour < 5 ? "Good night" : hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : hour < 21 ? "Good evening" : "Good night";
  return `${phase} · ${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()} ${MONTH[d.getUTCMonth()]}`;
}

// A small bordered panel for content below the §4 layout proper (today-by-hour,
// peak hours, next days) - kept from the pre-reskin page rather than dropped,
// just restyled to the paper surface instead of a glass Card.
function Panel({ title, action, children }) {
  return (
    <div className="rounded-md border border-ink/15 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-bill text-[11px] uppercase tracking-wide text-ink-soft">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function OverviewPage() {
  const { device } = useDevice();
  const summary = useApi("/api/stats/summary", { refreshMs: 30_000 });
  const today = useApi("/api/stats/history?range=day", { refreshMs: 60_000 });
  const alerts = useApi("/api/alerts", { refreshMs: 30_000 });
  const peak = useApi("/api/stats/peak-hours");
  const forecast = useApi("/api/forecast?months=1", { refreshMs: 10 * 60_000 });
  const now = useNow(30_000);
  const [monitorStats, setMonitorStats] = useState({ now: null, peak: null, avg: null, lastReadingTs: null });

  // A new live reading changes this month's (and today's) numbers: refresh at most every 20 s.
  const lastRefresh = useRef(0);
  const { reload: reloadSummary } = summary;
  const { reload: reloadToday } = today;
  const { reload: reloadAlerts } = alerts;
  const onReading = useCallback(() => {
    if (Date.now() - lastRefresh.current < 20_000) return;
    lastRefresh.current = Date.now();
    reloadSummary();
    reloadToday();
    reloadAlerts();
  }, [reloadSummary, reloadToday, reloadAlerts]);

  const s = summary.data;
  const todayStartMs = now ? new Date(now + PKT_OFFSET_MS).setUTCHours(0, 0, 0, 0) - PKT_OFFSET_MS : null;
  const spikesToday = alerts.data
    ? alerts.data.alerts.filter((a) => a.type === "anomaly" && todayStartMs != null && Date.parse(a.ts) >= todayStartMs)
    : null;

  return (
    <>
      <AlertTicker deviceId={device.id} />
      <AlertBanner alerts={alerts.data?.alerts} />
      <ErrorNote message={summary.error} onRetry={summary.reload} />

      <div className="mb-5">
        <p className="font-display text-[32px] font-black uppercase leading-none text-ink">{greeting(now) ?? " "}</p>
        <p className="mt-1 font-bill text-xs text-ink-soft">{device.name}</p>
      </div>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
        <div className="order-2 min-w-0 flex-1 lg:order-1">
          <Monitor deviceId={device.id} alerts={alerts.data?.alerts} onReading={onReading} onStats={setMonitorStats} />
          <VoltageMonitor />
        </div>
        <div className="order-1 lg:order-2 lg:w-60 lg:shrink-0">
          <StatusLights
            lastReadingTs={monitorStats.lastReadingTs}
            summary={s}
            spikesToday={spikesToday}
            weatherDay={forecast.data?.next_days?.[0]}
          />
        </div>
      </div>

      <Readouts now={monitorStats.now} peak={monitorStats.peak} avg={monitorStats.avg} todayKwh={s?.today_kwh} />

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <UnitsCounter value={s?.month_kwh} projected={s?.projected_month_kwh} />

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <SlabDial
            used={s?.month_kwh}
            projected={s?.projected_month_kwh}
            currentSlab={s?.current_slab}
            nextSlab={s?.next_slab}
            unitsToNextSlab={s?.units_to_next_slab}
            projectedSlab={s?.projected_slab}
          />
          <BillSlip
            billSoFar={s?.bill_so_far}
            projectedBill={s?.projected_bill}
            slabMode={s?.slab_mode}
            rate={s?.current_slab?.rate_per_unit}
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Panel title="Today by hour" action={<p className="font-bill text-[11px] text-ink-soft">{today.data ? `${fmtNum(today.data.total_kwh, 2)} kWh so far` : ""}</p>}>
          {today.data ? (
            <StripChart points={today.data.points} unit="hour" rate={s?.current_slab?.rate_per_unit} height={200} />
          ) : (
            <div className="skeleton h-[200px] w-full rounded-md" />
          )}
        </Panel>

        <Panel title="Peak hours · last 14 days">
          {peak.data ? (
            <>
              <div className="flex flex-wrap gap-2">
                {[...peak.data.top_hours].sort((a, b) => a - b).map((hh) => (
                  <span key={hh} className="rounded-sm bg-ink px-2.5 py-1 font-bill text-[11px] text-paper">
                    {hourLabel(hh)} – {hourLabel(hh + 1)}
                  </span>
                ))}
              </div>
              <p className="mt-3 text-sm leading-relaxed text-ink-soft">{peak.data.message}</p>
            </>
          ) : (
            <div className="skeleton h-24 w-full rounded-md" />
          )}
        </Panel>

        <Panel title="Next days" action={<Link href="/forecast" className="font-bill text-[11px] text-ink-soft hover:text-ink">Forecast →</Link>}>
          {forecast.data ? (
            <div className="grid grid-cols-3 gap-2">
              {forecast.data.next_days.slice(0, 3).map((d) => (
                <div key={d.date} className="rounded-sm bg-paper-dark p-3 text-center">
                  <p className="font-bill text-[10px] text-ink-soft">{d.weekday}</p>
                  <p className="my-1 text-2xl" aria-label={d.condition}>{WEATHER_EMOJI[d.icon]}</p>
                  <p className="font-bill text-sm">
                    {Math.round(d.temp_max_c)}° <span className="text-ink-soft">{Math.round(d.temp_min_c)}°</span>
                  </p>
                  <p className="font-bill text-[10px] text-ink-soft">{fmtNum(d.predicted_kwh, 1)} kWh</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="skeleton h-28 w-full rounded-md" />
          )}
        </Panel>
      </div>
    </>
  );
}
