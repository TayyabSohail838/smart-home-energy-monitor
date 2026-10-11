"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";
import AlertBanner from "@/components/AlertBanner";
import { UsageBars } from "@/components/charts";
import LivePanel from "@/components/LivePanel";
import PageHeader from "@/components/PageHeader";
import { useDevice } from "@/components/Shell";
import SlabMeter from "@/components/SlabMeter";
import { AnimatedNumber, Badge, Card, ErrorNote, Skeleton } from "@/components/ui";
import { fmtNum, fmtRs, hourLabel, WEATHER_EMOJI } from "@/lib/format";
import { useApi } from "@/lib/useApi";

function MetricCard({ label, value, format, unit, hint, delay }) {
  return (
    <Card delay={delay}>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-2 text-3xl font-medium tracking-tight">
        {value == null ? <Skeleton className="h-9 w-28" /> : <AnimatedNumber value={value} format={format} />}
        {unit && value != null && <span className="ml-1 text-base text-ink-3">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-ink-3">{hint}</p>}
    </Card>
  );
}

export default function OverviewPage() {
  const { device } = useDevice();
  const summary = useApi("/api/stats/summary", { refreshMs: 30_000 });
  const today = useApi("/api/stats/history?range=day", { refreshMs: 60_000 });
  const alerts = useApi("/api/alerts", { refreshMs: 30_000 });
  const peak = useApi("/api/stats/peak-hours");
  const forecast = useApi("/api/forecast?months=3");

  // A new live reading changes today's numbers: refresh them, at most every 20 s.
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
  const slabRange = (slab) => (slab.max_units === null ? `${slab.min_units}+` : `${slab.min_units}–${slab.max_units}`);
  const nextSlabNote =
    s && s.units_to_next_slab != null && s.next_slab
      ? `${fmtNum(s.units_to_next_slab)} units until slab ${slabRange(s.next_slab)}`
      : "Top slab";

  return (
    <>
      <PageHeader title="Good to see you" subtitle={`${device.name} · live electricity use, bill and alerts`} />
      <AlertBanner alerts={alerts.data?.alerts} />
      <ErrorNote message={summary.error} onRetry={summary.reload} />

      <div className="grid gap-5 lg:grid-cols-3">
        <LivePanel deviceId={device.id} onReading={onReading} />

        <Card delay={120} title="Bill so far" subtitle="Energy charge only · excl. taxes & FPA">
          <p className="text-4xl font-medium tracking-tight">
            {s ? <AnimatedNumber value={s.bill_so_far} format={fmtRs} /> : <Skeleton className="h-10 w-36" />}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-ink-3">Month-end estimate</p>
              <p className="mt-1 text-lg font-medium">{s ? fmtRs(s.projected_bill) : "…"}</p>
            </div>
            <div>
              <p className="text-xs text-ink-3">Rate now</p>
              <p className="mt-1 text-lg font-medium">{s ? `Rs ${s.current_slab.rate_per_unit}` : "…"}<span className="text-xs text-ink-3"> /unit</span></p>
            </div>
          </div>
          {s && s.projected_slab.min_units > s.current_slab.min_units && (
            <div className="mt-4">
              <Badge status="warning">Heading for slab {slabRange(s.projected_slab)}</Badge>
            </div>
          )}
        </Card>

        <MetricCard delay={160} label="Today" value={s?.today_kwh} format={(n) => fmtNum(n, 2)} unit="kWh" hint="Since midnight (Pakistan time)" />
        <MetricCard delay={200} label="This month" value={s?.month_kwh} format={(n) => fmtNum(n, 1)} unit="kWh" hint={s ? `Day ${Math.ceil(s.days_passed)} of ${s.days_in_month}` : null} />
        <MetricCard delay={240} label="Projected month" value={s?.projected_month_kwh} format={(n) => fmtNum(n)} unit="units" hint={nextSlabNote} />

        <Card delay={280} className="lg:col-span-2" title="Tariff slab" subtitle="NEPRA 2026 unprotected · all units billed at your slab's rate">
          {s ? <SlabMeter used={s.month_kwh} projected={s.projected_month_kwh} currentSlabId={s.current_slab.id} /> : <Skeleton className="h-16 w-full" />}
        </Card>

        <Card
          delay={320}
          title="Next days"
          subtitle="Weather and predicted use"
          action={<Link href="/forecast" className="text-xs text-ink-2 hover:text-ink">Forecast →</Link>}
        >
          {forecast.data ? (
            <>
              <p className="text-sm leading-relaxed text-ink-2">{forecast.data.outlook.headline.split(". ")[0]}.</p>
              <div className="mt-4 grid grid-cols-3 gap-2">
                {forecast.data.next_days.slice(0, 3).map((d) => (
                  <div key={d.date} className="rounded-2xl bg-white/70 p-3 text-center ring-1 ring-black/5">
                    <p className="text-xs text-ink-3">{d.weekday}</p>
                    <p className="my-1 text-2xl" aria-label={d.condition}>{WEATHER_EMOJI[d.icon]}</p>
                    <p className="text-sm font-medium">{Math.round(d.temp_max_c)}° <span className="text-ink-3">{Math.round(d.temp_min_c)}°</span></p>
                    <p className="text-[11px] text-ink-3">{fmtNum(d.predicted_kwh, 1)} kWh</p>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <Skeleton className="h-32 w-full" />
          )}
        </Card>

        <Card
          delay={360}
          className="lg:col-span-2"
          title="Today by hour"
          subtitle={today.data ? `${fmtNum(today.data.total_kwh, 2)} kWh so far` : " "}
          action={<Link href="/usage" className="text-xs text-ink-2 hover:text-ink">More graphs →</Link>}
        >
          {today.data ? <UsageBars points={today.data.points} unit="hour" height={200} /> : <Skeleton className="h-[200px] w-full" />}
        </Card>

        <Card delay={400} title="Peak hours" subtitle="Last 14 days">
          {peak.data ? (
            <>
              <div className="flex flex-wrap gap-2">
                {[...peak.data.top_hours].sort((a, b) => a - b).map((h) => (
                  <span key={h} className="rounded-full bg-ink px-3 py-1 text-xs text-white">
                    {hourLabel(h)} – {hourLabel(h + 1)}
                  </span>
                ))}
              </div>
              <p className="mt-4 text-sm leading-relaxed text-ink-2">{peak.data.message}</p>
            </>
          ) : (
            <Skeleton className="h-24 w-full" />
          )}
        </Card>
      </div>
    </>
  );
}
