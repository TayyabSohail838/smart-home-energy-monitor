"use client";

import { useState } from "react";
import { PeakHoursChart, UsageBars } from "@/components/charts";
import PageHeader from "@/components/PageHeader";
import { AnimatedNumber, Card, ErrorNote, Skeleton, Stat, Tabs } from "@/components/ui";
import { fmtDay, fmtNum, hourLabel } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const RANGES = [
  { value: "day", label: "Today" },
  { value: "week", label: "7 days" },
  { value: "month", label: "This month" },
  { value: "30d", label: "30 days" },
];

export default function UsagePage() {
  const [range, setRange] = useState("week");
  const [showTable, setShowTable] = useState(false);
  const history = useApi(`/api/stats/history?range=${range}`, { refreshMs: 60_000 });
  const peak = useApi("/api/stats/peak-hours");

  const h = history.data;
  const filled = h ? h.points.filter((p) => p.kwh != null) : [];
  const busiest = filled.reduce((b, p) => (b == null || p.kwh > b.kwh ? p : b), null);
  const avg = filled.length ? h.total_kwh / filled.length : null;
  const label = (p) => (h.unit === "hour" ? hourLabel(Number(p.bucket.slice(11, 13))) : fmtDay(p.bucket));

  return (
    <>
      <PageHeader title="Usage" subtitle="How many units you use, and when">
        <Tabs options={RANGES} value={range} onChange={setRange} />
      </PageHeader>
      <ErrorNote message={history.error} onRetry={history.reload} />

      <div className="grid gap-5 lg:grid-cols-4">
        <Card delay={0}>
          <Stat label={`Total · ${RANGES.find((r) => r.value === range).label}`}>
            {h ? <><AnimatedNumber value={h.total_kwh} format={(n) => fmtNum(n, 1)} /> <span className="text-sm text-ink-3">kWh</span></> : <Skeleton className="h-7 w-24" />}
          </Stat>
        </Card>
        <Card delay={40}>
          <Stat label={`Average per ${h?.unit ?? "day"}`}>
            {avg != null ? <><AnimatedNumber value={avg} format={(n) => fmtNum(n, 2)} /> <span className="text-sm text-ink-3">kWh</span></> : <Skeleton className="h-7 w-24" />}
          </Stat>
        </Card>
        <Card delay={80}>
          <Stat label={`Busiest ${h?.unit ?? "day"}`} hint={busiest ? `${fmtNum(busiest.kwh, 2)} kWh` : null}>
            {busiest ? label(busiest) : <Skeleton className="h-7 w-24" />}
          </Stat>
        </Card>
        <Card delay={120}>
          <Stat label="Units = kWh" hint="1 unit on your bill = 1 kWh">
            {h ? `${h.points.length} ${h.unit}s` : <Skeleton className="h-7 w-24" />}
          </Stat>
        </Card>

        <Card
          delay={160}
          className="lg:col-span-4"
          title={h?.unit === "hour" ? "Energy per hour" : "Energy per day"}
          subtitle="Hover a bar for the exact value"
          action={
            <button onClick={() => setShowTable((v) => !v)} className="rounded-full bg-white/70 px-3 py-1 text-xs text-ink-2 ring-1 ring-black/5 hover:bg-white">
              {showTable ? "Show chart" : "Show table"}
            </button>
          }
        >
          {!h ? (
            <Skeleton className="h-[300px] w-full" />
          ) : showTable ? (
            <div className="max-h-[300px] overflow-auto rounded-2xl ring-1 ring-black/5">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white/90 text-left text-xs text-ink-3">
                  <tr><th className="px-4 py-2 font-normal">{h.unit === "hour" ? "Hour" : "Day"}</th><th className="px-4 py-2 text-right font-normal">kWh</th></tr>
                </thead>
                <tbody>
                  {h.points.map((p) => (
                    <tr key={p.bucket} className="border-t border-black/5">
                      <td className="px-4 py-2">{label(p)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{p.kwh == null ? "–" : fmtNum(p.kwh, 2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div key={range} className="animate-fade-up">
              <UsageBars points={h.points} unit={h.unit} height={300} />
            </div>
          )}
        </Card>

        <Card delay={200} className="lg:col-span-3" title="Peak hours" subtitle="Average power for each hour of the day · last 14 days">
          {peak.data ? <PeakHoursChart hours={peak.data.hours} top={peak.data.top_hours} /> : <Skeleton className="h-[260px] w-full" />}
        </Card>

        <Card delay={240} title="What this means">
          {peak.data ? (
            <>
              <p className="text-sm leading-relaxed text-ink-2">{peak.data.message}</p>
              <ul className="mt-4 space-y-2 text-sm text-ink-2">
                {[...peak.data.hours]
                  .filter((x) => x.samples > 0)
                  .sort((a, b) => b.avg_power_w - a.avg_power_w)
                  .slice(0, 3)
                  .map((x, i) => (
                    <li key={x.hour} className="flex items-center justify-between rounded-2xl bg-white/70 px-3 py-2 ring-1 ring-black/5">
                      <span>#{i + 1} · {hourLabel(x.hour)}</span>
                      <span className="font-medium tabular-nums text-ink">{fmtNum(x.avg_power_w)} W</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Card>
      </div>
    </>
  );
}
