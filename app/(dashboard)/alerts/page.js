"use client";

import { useState } from "react";
import Stamp from "@/components/auth/Stamp";
import Logbook from "@/components/meter/Logbook";
import WallSwitch from "@/components/meter/WallSwitch";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, ErrorNote, Skeleton, Tabs } from "@/components/ui";
import { useApi } from "@/lib/useApi";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "anomaly", label: "Unusual usage" },
  { value: "slab_warning", label: "Slab warnings" },
  { value: "voltage", label: "High voltage" },
];

// Settings panel (dashboard-design.md §7.1): the wall switch + alert email,
// at the top of the page so BreakerNav's "/alerts#settings" link lands on it.
function EmailSettings() {
  const settings = useApi("/api/settings");
  const [edited, setEdited] = useState(null); // local edits; falls back to the loaded settings
  const form = edited ?? settings.data;
  const setForm = setEdited;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveCount, setSaveCount] = useState(0);

  async function save(changes) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(changes),
      });
      // A 500 can come back as an HTML error page, so don't assume JSON.
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setError(body.error ?? `Could not save (${res.status})`);
      setForm(body);
      setSaveCount((c) => c + 1);
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      // Always re-enable the form, or the switch and Save button stay dead.
      setSaving(false);
    }
  }

  return (
    <div id="settings" className="rounded-md border border-ink/15 p-5">
      <p className="mb-4 font-bill text-[11px] uppercase tracking-wide text-ink-soft">
        Email alerts · sent through Resend when an alert fires
      </p>
      {!form ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <div className="flex flex-wrap items-start gap-8">
          <WallSwitch checked={form.email_alerts} disabled={saving} label="Email alerts" onChange={(v) => save({ email_alerts: v })} />

          <form
            onSubmit={(e) => {
              e.preventDefault();
              save({ alert_email: form.alert_email });
            }}
            className="flex min-w-[220px] flex-1 items-end gap-2"
          >
            <div className="min-w-0 flex-1">
              <span className="font-bill text-[10px] uppercase tracking-wide text-ink-soft">Send to</span>
              <input
                type="email"
                value={form.alert_email ?? ""}
                onChange={(e) => setForm({ ...form, alert_email: e.target.value })}
                className="mt-1 w-full rounded-sm border border-ink/30 bg-paper px-3 py-2 font-bill text-sm text-ink outline-none focus:border-ink"
              />
            </div>
            <button
              disabled={saving}
              className="rounded-sm border border-ink bg-ink px-4 py-2 font-bill text-xs uppercase tracking-wide text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Save
            </button>
          </form>

          <div className="flex items-center gap-3">
            {saveCount > 0 && !error && (
              <Stamp key={saveCount} tone="green" className="text-[10px]">
                Saved
              </Stamp>
            )}
            {error && <p className="text-sm text-[var(--stamp-red)]">⚠ {error}</p>}
          </div>
        </div>
      )}
      <p className="mt-4 text-xs leading-relaxed text-ink-soft">
        Demo setup: without a verified domain, Resend only delivers to the email that owns the Resend account.
      </p>
    </div>
  );
}

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

      <EmailSettings />

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

        <Card delay={120} title="How alerts work" hover={false}>
          <ul className="space-y-3 text-sm text-ink-2">
            <li>
              <Badge status="critical">Unusual usage</Badge>
              <p className="mt-1">The last 5 minutes are far above what your home normally uses at this hour (μ + 3σ and 300 W more). At most one every 30 minutes.</p>
            </li>
            <li>
              <Badge status="warning">Slab warning</Badge>
              <p className="mt-1">This month&apos;s projection lands in a more expensive slab. Once per slab per month.</p>
            </li>
          </ul>
        </Card>
      </div>
    </>
  );
}
