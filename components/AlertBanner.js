"use client";

import Link from "next/link";
import { useState } from "react";
import { fmtDateTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";

const DAY_MS = 24 * 3600 * 1000;

// Red banner for an anomaly or high voltage, amber for a slab warning, from the last 24 hours.
export default function AlertBanner({ alerts }) {
  const [dismissed, setDismissed] = useState(new Set());
  const now = useNow(60_000);
  if (!now) return null;
  const recent = (alerts ?? []).filter((a) => now - Date.parse(a.ts) < DAY_MS && !dismissed.has(a.id));
  const alert = recent.find((a) => a.type === "voltage" || a.type === "anomaly") ?? recent[0];
  if (!alert) return null;

  const anomaly = alert.type === "anomaly" || alert.type === "voltage";
  const title = { anomaly: "Unusual usage", voltage: "High voltage" }[alert.type] ?? "Slab warning";
  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3 rounded-3xl px-5 py-4 animate-fade-up ring-1"
      style={{
        background: anomaly ? "rgba(208,59,59,0.09)" : "rgba(250,178,25,0.14)",
        boxShadow: `inset 0 0 0 1px ${anomaly ? "rgba(208,59,59,0.25)" : "rgba(250,178,25,0.4)"}`,
      }}
    >
      <span className="mt-0.5 text-lg" aria-hidden>{alert.type === "voltage" ? "⚡" : anomaly ? "⚠️" : "📈"}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: anomaly ? "var(--critical)" : "#8a5d00" }}>
          {title} · {fmtDateTime(alert.ts)}
          {alert.emailed && <span className="ml-2 text-xs font-normal text-ink-3">✉ emailed</span>}
        </p>
        <p className="mt-0.5 text-sm text-ink-2">{alert.message}</p>
      </div>
      <Link href="/alerts" className="shrink-0 rounded-full bg-white/80 px-3 py-1 text-xs text-ink ring-1 ring-black/5 hover:bg-white">
        All alerts
      </Link>
      <button
        onClick={() => setDismissed(new Set([...dismissed, alert.id]))}
        className="shrink-0 rounded-full px-2 text-ink-3 hover:text-ink"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
