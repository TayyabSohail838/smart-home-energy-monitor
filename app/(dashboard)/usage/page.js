"use client";

import { useState } from "react";
import PeakClock from "@/components/meter/PeakClock";
import { Panel } from "@/components/meter/Panel";
import StripChart, { rowLabel } from "@/components/meter/StripChart";
import PageHeader from "@/components/PageHeader";
import { ErrorNote, Skeleton, Tabs } from "@/components/ui";
import { fmtNum, hourLabel } from "@/lib/format";
import { useApi } from "@/lib/useApi";

function Readout({ label, children }) {
  return (
    <p className="font-bill text-[11px] uppercase tracking-wide">
      <span className="text-ink-soft">{label}</span> <span className="text-ink">{children}</span>
    </p>
  );
}

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
  const summary = useApi("/api/stats/summary", { refreshMs: 60_000 });
  const peak = useApi("/api/stats/peak-hours");

  const h = history.data;
  const rate = summary.data?.current_slab?.rate_per_unit;
  const filled = h ? h.points.filter((p) => p.kwh != null) : [];
  const busiest = filled.reduce((b, p) => (b == null || p.kwh > b.kwh ? p : b), null);
  const avg = filled.length ? h.total_kwh / filled.length : null;
  const rangeLabel = RANGES.find((r) => r.value === range).label;

  return (
    <>
      <PageHeader title="Usage" subtitle="How many units you use, and when">
        <Tabs options={RANGES} value={range} onChange={setRange} />
      </PageHeader>
      <ErrorNote message={history.error} onRetry={history.reload} />

      <div className="mb-3 flex flex-wrap items-end justify-between gap-3 border-b-2 border-dotted border-rule pb-3">
        <div className="flex flex-wrap gap-x-6 gap-y-1">
          {h ? (
            <>
              <Readout label={`Total · ${rangeLabel}`}>{fmtNum(h.total_kwh, 1)} kWh</Readout>
              <Readout label={`Avg / ${h.unit}`}>{avg != null ? `${fmtNum(avg, 2)} kWh` : "–"}</Readout>
              <Readout label={`Busiest ${h.unit}`}>{busiest ? `${rowLabel(h.unit)(busiest.bucket)} · ${fmtNum(busiest.kwh, 2)} kWh` : "–"}</Readout>
              <Readout label="Units">{h.points.length} {h.unit}s = kWh</Readout>
            </>
          ) : (
            <span className="font-bill text-[11px] text-ink-soft">{" "}</span>
          )}
        </div>
        <button
          onClick={() => setShowTable((v) => !v)}
          className="rounded-sm border border-ink/30 px-3 py-1 font-bill text-[11px] uppercase tracking-wide text-ink-soft hover:border-ink hover:text-ink"
        >
          {showTable ? "Graph" : "Table"}
        </button>
      </div>

      {!h ? (
        <Skeleton className="h-[300px] w-full rounded-md" />
      ) : (
        <div key={range} className="animate-strip-feed">
          {showTable ? (
            <div className="max-h-[420px] overflow-auto rounded-md border border-ink/20">
              <table className="w-full font-bill text-xs">
                <thead className="sticky top-0 bg-paper-dark text-left uppercase tracking-wide text-ink-soft">
                  <tr>
                    <th className="px-4 py-2 font-normal">{h.unit === "hour" ? "Hour" : "Date"}</th>
                    <th className="px-4 py-2 text-right font-normal">kWh</th>
                    <th className="px-4 py-2 text-right font-normal">Est. Rs</th>
                  </tr>
                </thead>
                <tbody>
                  {h.points.map((p, i) => (
                    <tr key={p.bucket} className={i % 2 === 1 ? "bg-black/[0.025]" : ""}>
                      <td className="border-t border-dotted border-rule px-4 py-1.5">{rowLabel(h.unit)(p.bucket)}</td>
                      <td className="border-t border-dotted border-rule px-4 py-1.5 text-right tabular-nums">
                        {p.kwh == null ? "–" : fmtNum(p.kwh, 2)}
                      </td>
                      <td className="border-t border-dotted border-rule px-4 py-1.5 text-right tabular-nums">
                        {p.kwh == null || rate == null ? "–" : `~${fmtNum(Math.round(p.kwh * rate))}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-4 border-double border-ink font-medium">
                    <td className="px-4 py-2">Total</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmtNum(h.total_kwh, 2)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      {rate != null ? `~${fmtNum(Math.round(h.total_kwh * rate))}` : "–"}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ) : (
            <StripChart points={h.points} unit={h.unit} rate={rate} height={300} />
          )}
        </div>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <Panel className="lg:col-span-2" title="Peak hours · last 14 days">
          {peak.data ? (
            <PeakClock hours={peak.data.hours} topHours={peak.data.top_hours} message={peak.data.message} />
          ) : (
            <Skeleton className="h-[260px] w-full" />
          )}
        </Panel>

        <Panel title="What this means">
          {peak.data ? (
            <>
              <p className="text-sm leading-relaxed text-ink-soft">{peak.data.message}</p>
              <ul className="mt-4 space-y-2">
                {[...peak.data.hours]
                  .filter((x) => x.samples > 0)
                  .sort((a, b) => b.avg_power_w - a.avg_power_w)
                  .slice(0, 3)
                  .map((x, i) => (
                    <li key={x.hour} className="flex items-center justify-between rounded-sm bg-paper-dark px-3 py-2 font-bill text-[11px]">
                      <span className="text-ink-soft">#{i + 1} · {hourLabel(x.hour)}</span>
                      <span className="tabular-nums text-ink">{fmtNum(x.avg_power_w)} W</span>
                    </li>
                  ))}
              </ul>
            </>
          ) : (
            <Skeleton className="h-40 w-full" />
          )}
        </Panel>
      </div>
    </>
  );
}
