"use client";

import EmailSettings from "@/components/meter/EmailSettings";
import { Panel } from "@/components/meter/Panel";
import PageHeader from "@/components/PageHeader";
import { useDevice } from "@/components/Shell";

// Standalone Settings page (dashboard-design.md §7.1's panel, given its own
// route): Shell already has the user + device in hand by the time any page
// under it renders, so the account panel below is read-only, no extra fetch.
export default function SettingsPage() {
  const { user, device } = useDevice();

  return (
    <>
      <PageHeader title="Settings" subtitle="Your account, device and email alerts" />

      <EmailSettings />

      <Panel title="Account">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="font-bill text-[10px] uppercase tracking-wide text-ink-soft">Signed in as</dt>
            <dd className="mt-1 text-sm text-ink">{user?.email}</dd>
          </div>
          <div>
            <dt className="font-bill text-[10px] uppercase tracking-wide text-ink-soft">Device</dt>
            <dd className="mt-1 text-sm text-ink">{device?.name}</dd>
          </div>
        </dl>
      </Panel>
    </>
  );
}
