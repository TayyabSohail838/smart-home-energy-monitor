"use client";

import Link from "next/link";
import { useState } from "react";
import Stamp from "@/components/auth/Stamp";
import Logbook from "@/components/meter/Logbook";
import { Panel } from "@/components/meter/Panel";
import PageHeader from "@/components/PageHeader";
import { ErrorNote, Skeleton, Tabs } from "@/components/ui";
import { useApi } from "@/lib/useApi";

// Matches Logbook's STAMP map (components/meter/Logbook.js), so the same
// alert type reads the same way everywhere on the page.
const HOW_IT_WORKS = [
  {
    type: "anomaly",
    tone: "red",
    label: "Unusual usage",
    detail: "The last 5 minutes are far above what your home normally uses at this hour (μ + 3σ and 300 W more). At most one every 30 minutes.",
  },
  {
    type: "slab_warning",
    tone: "ink",
    label: "Slab warning",
    detail: "This month's projection lands in a more expensive slab, or you're within 10 units of the current slab's limit. At most once per slab per month.",
  },
  {
    type: "voltage",
    tone: "red",
    label: "High voltage",
    detail: "Mains voltage reads above 250 V. Pakistani mains is nominally 230 V. At most one every 30 minutes.",
  },
];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "anomaly", label: "Unusual usage" },
  { value: "slab_warning", label: "Slab warnings" },
  { value: "voltage", label: "High voltage" },
];

export default function AlertsPage() {
  const [filter, setFilter] = useState("all");
  const alerts = useApi("/api/alerts", { refreshMs: 20_000 });
  const list = (alerts.data?.alerts ?? []).filter((a) => filter === "all" || a.type === filter);
  const counts = (alerts.data?.alerts ?? []).reduce((c, a) => ({ ...c, [a.type]: (c[a.type] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader title="Alerts" subtitle="Unusual spikes, high voltage and tariff-slab warnings, newest first">
        <Tabs options={FILTERS} value={filter} onChange={setFilter} />
      </PageHeader>
      <ErrorNote message={alerts.error} onRetry={alerts.reload} />

      <p className="mb-6 text-sm text-ink-soft">
        Email alerts are <Link href="/settings" className="underline underline-offset-2 hover:text-ink">set up in Settings</Link>.
      </p>

      <div className="mt-6 grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-3 font-bill text-[11px] uppercase tracking-wide text-ink-soft">
            {list.length} alert{list.length === 1 ? "" : "s"} · {counts.anomaly ?? 0} unusual usage · {counts.slab_warning ?? 0} slab warnings · {counts.voltage ?? 0} high voltage · updates every 20s
          </p>
          {!alerts.data ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : (
            <Logbook alerts={list} />
          )}
        </div>

        <Panel title="How alerts work">
          <ul className="space-y-4">
            {HOW_IT_WORKS.map((x) => (
              <li key={x.type} className="border-t border-dotted border-rule pt-3 first:border-t-0 first:pt-0">
                <Stamp tone={x.tone} className="text-[10px]">{x.label}</Stamp>
                <p className="mt-2 text-sm leading-relaxed text-ink-soft">{x.detail}</p>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </>
  );
}
