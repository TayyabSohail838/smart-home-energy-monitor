"use client";

import { useEffect, useRef, useState } from "react";
import Stamp from "@/components/auth/Stamp";
import { fmtTime, fmtWeekdayDay } from "@/lib/format";
import { useNow } from "@/lib/useNow";

const PKT_OFFSET_MS = 5 * 3600 * 1000; // Asia/Karachi is UTC+5 all year
const pad = (n) => String(n).padStart(2, "0");

function dayKey(ts) {
  const d = new Date(Date.parse(ts) + PKT_OFFSET_MS);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function dayLabel(key, now) {
  if (key === dayKey(new Date(now).toISOString())) return "TODAY";
  if (key === dayKey(new Date(now - 86_400_000).toISOString())) return "YESTERDAY";
  return fmtWeekdayDay(key).toUpperCase();
}

const STAMP = {
  anomaly: { label: "SPIKE", emoji: "🔴" },
  slab_warning: { label: "SLAB", emoji: "🟠" },
  voltage: { label: "VOLTAGE", emoji: "⚡" },
};

// The alert logbook (dashboard-design.md §7.2): lined paper with a red
// margin rule, day dividers, one entry per alert. New alerts arriving while
// the page is open slide in at the top with a short highlight.
export default function Logbook({ alerts }) {
  const now = useNow(60_000);
  const seenRef = useRef(null);
  const [freshIds, setFreshIds] = useState(new Set());

  useEffect(() => {
    const ids = new Set(alerts.map((a) => a.id));
    if (seenRef.current === null) {
      seenRef.current = ids;
      return;
    }
    const fresh = [...ids].filter((id) => !seenRef.current.has(id));
    seenRef.current = ids;
    if (fresh.length === 0) return;
    setFreshIds(new Set(fresh));
    const t = setTimeout(() => setFreshIds(new Set()), 2500);
    return () => clearTimeout(t);
  }, [alerts]);

  if (alerts.length === 0) {
    return (
      <div className="grid place-items-center rounded-md border border-ink/15 py-14 text-center">
        <Stamp tone="green">All clear</Stamp>
        <p className="mt-3 text-sm text-ink-soft">No alerts in the last 30 days.</p>
      </div>
    );
  }

  // Precomputed in a plain loop, not inside the render map, so no variable is
  // reassigned from within a closure React retains for later.
  const rows = [];
  let last = null;
  for (const a of alerts) {
    const key = dayKey(a.ts);
    rows.push({ a, key, showDivider: key !== last });
    last = key;
  }

  return (
    <div className="border-l-2 pl-5" style={{ borderColor: "var(--stamp-red)" }}>
      {rows.map(({ a, key, showDivider }) => {
        const stamp = STAMP[a.type] ?? STAMP.anomaly;
        const fresh = freshIds.has(a.id);
        return (
          <div key={a.id}>
            {showDivider && (
              <div className="mb-2 mt-4 flex items-center gap-2 font-bill text-[11px] uppercase tracking-wide text-ink-soft first:mt-0">
                <span className="h-px flex-1 border-t border-dotted border-rule" />
                {now ? dayLabel(key, now) : ""}
                <span className="h-px flex-1 border-t border-dotted border-rule" />
              </div>
            )}
            <div
              className={`flex flex-wrap items-start gap-3 border-b border-dotted border-rule py-3 ${
                fresh ? "animate-slide-in animate-flash" : ""
              }`}
            >
              <span className="w-16 shrink-0 font-bill text-xs text-ink-soft">{fmtTime(a.ts)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm leading-relaxed text-ink">{a.message}</p>
                <p className="mt-1 font-bill text-[10px] uppercase tracking-wide text-ink-soft">
                  {a.emailed ? "✉ Sent" : "Not sent"}
                </p>
              </div>
              <span className="shrink-0 font-bill text-[11px] uppercase tracking-wide text-ink-soft">
                {stamp.emoji} {stamp.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
