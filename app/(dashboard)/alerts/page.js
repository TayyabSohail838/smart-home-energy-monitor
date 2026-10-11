"use client";

import { useState } from "react";
import PageHeader from "@/components/PageHeader";
import { Badge, Card, ErrorNote, Skeleton, Tabs, Toggle } from "@/components/ui";
import { fmtDateTime, fmtNum, timeAgo } from "@/lib/format";
import { useApi } from "@/lib/useApi";

const FILTERS = [
  { value: "all", label: "All" },
  { value: "anomaly", label: "Unusual usage" },
  { value: "slab_warning", label: "Slab warnings" },
];

function EmailSettings() {
  const settings = useApi("/api/settings");
  const [edited, setEdited] = useState(null); // local edits; falls back to the loaded settings
  const form = edited ?? settings.data;
  const setForm = setEdited;
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState(null);

  async function save(changes) {
    setSaving(true);
    setNote(null);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(changes),
    });
    const body = await res.json();
    setSaving(false);
    if (!res.ok) return setNote({ ok: false, text: body.error });
    setForm(body);
    setNote({ ok: true, text: "Saved" });
  }

  return (
    <Card delay={60} title="Email alerts" subtitle="Sent through Resend when an alert fires">
      {!form ? (
        <Skeleton className="h-28 w-full" />
      ) : (
        <div className="space-y-5">
          <label className="flex items-center justify-between gap-4">
            <span className="text-sm text-ink-2">Email me about alerts</span>
            <Toggle checked={form.email_alerts} disabled={saving} label="Email alerts" onChange={(v) => save({ email_alerts: v })} />
          </label>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save({ alert_email: form.alert_email });
            }}
          >
            <span className="text-xs text-ink-3">Send to</span>
            <div className="mt-1 flex gap-2">
              <input
                type="email"
                value={form.alert_email ?? ""}
                onChange={(e) => setForm({ ...form, alert_email: e.target.value })}
                className="min-w-0 flex-1 rounded-2xl bg-white/80 px-3 py-2 text-sm outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-ink/30"
              />
              <button disabled={saving} className="rounded-2xl bg-ink px-4 text-sm text-white transition-opacity hover:opacity-90 disabled:opacity-50">
                Save
              </button>
            </div>
          </form>
          {note && <p className={`text-xs ${note.ok ? "text-[#006300]" : "text-[var(--critical)]"}`}>{note.ok ? "✓" : "⚠"} {note.text}</p>}
          <p className="text-xs leading-relaxed text-ink-3">
            Demo setup: without a verified domain, Resend only delivers to the email that owns the Resend account.
          </p>
        </div>
      )}
    </Card>
  );
}

export default function AlertsPage() {
  const [filter, setFilter] = useState("all");
  const alerts = useApi("/api/alerts", { refreshMs: 20_000 });
  const list = (alerts.data?.alerts ?? []).filter((a) => filter === "all" || a.type === filter);
  const counts = (alerts.data?.alerts ?? []).reduce((c, a) => ({ ...c, [a.type]: (c[a.type] ?? 0) + 1 }), {});

  return (
    <>
      <PageHeader title="Alerts" subtitle="Unusual spikes and tariff-slab warnings, newest first">
        <Tabs options={FILTERS} value={filter} onChange={setFilter} />
      </PageHeader>
      <ErrorNote message={alerts.error} onRetry={alerts.reload} />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card delay={0} className="lg:col-span-2" title={`${list.length} alert${list.length === 1 ? "" : "s"}`} subtitle={`${counts.anomaly ?? 0} unusual usage · ${counts.slab_warning ?? 0} slab warnings · updates every 20 s`}>
          {!alerts.data ? (
            <div className="space-y-3">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          ) : list.length === 0 ? (
            <div className="grid place-items-center rounded-2xl border border-dashed border-black/10 py-14 text-center text-sm text-ink-3">
              <p className="text-3xl">✓</p>
              <p className="mt-2">No alerts. Usage looks normal.</p>
              <p className="mt-1 text-xs">Try <code className="rounded bg-black/5 px-1">npm run fake-device -- --watts 3000</code> for a few minutes.</p>
            </div>
          ) : (
            <ol className="relative space-y-3 border-l border-black/10 pl-5">
              {list.map((a, i) => {
                const anomaly = a.type === "anomaly";
                return (
                  <li key={a.id} className="animate-fade-up relative" style={{ animationDelay: `${i * 40}ms` }}>
                    <span
                      className="absolute -left-[27px] top-4 h-3 w-3 rounded-full ring-4 ring-[var(--page)]"
                      style={{ background: anomaly ? "var(--critical)" : "var(--warning)" }}
                    />
                    <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-black/5 transition-colors hover:bg-white">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge status={anomaly ? "critical" : "warning"}>{anomaly ? "Unusual usage" : "Slab warning"}</Badge>
                        {a.power_w != null && <span className="text-xs text-ink-2">{fmtNum(a.power_w)} W</span>}
                        <span className="ml-auto text-xs text-ink-3" title={fmtDateTime(a.ts)}>{timeAgo(a.ts)}</span>
                      </div>
                      <p className="mt-2 text-sm leading-relaxed text-ink-2">{a.message}</p>
                      <p className="mt-2 text-xs text-ink-3">
                        {fmtDateTime(a.ts)} · {a.emailed ? "✉ Emailed" : "Not emailed"}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </Card>

        <div className="space-y-5">
          <EmailSettings />
          <Card delay={120} title="How alerts work" hover={false}>
            <ul className="space-y-3 text-sm text-ink-2">
              <li><Badge status="critical">Unusual usage</Badge><p className="mt-1">The last 5 minutes are far above what your home normally uses at this hour (μ + 3σ and 300 W more). At most one every 30 minutes.</p></li>
              <li><Badge status="warning">Slab warning</Badge><p className="mt-1">This month&apos;s projection lands in a more expensive slab. Once per slab per month.</p></li>
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
