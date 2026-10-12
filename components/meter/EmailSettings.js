"use client";

import { useState } from "react";
import Stamp from "@/components/auth/Stamp";
import { Panel } from "@/components/meter/Panel";
import WallSwitch from "@/components/meter/WallSwitch";
import { Skeleton } from "@/components/ui";
import { useApi } from "@/lib/useApi";

// Settings panel (dashboard-design.md §7.1): the wall switch + alert email.
// Shown on its own /settings page (the sidebar's Settings breaker).
export default function EmailSettings() {
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
    <Panel id="settings" title="Email alerts · sent through Resend when an alert fires" className="mb-6">
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
    </Panel>
  );
}

