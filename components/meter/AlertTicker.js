"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { fmtNum, fmtTime } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";

// Thin red strip for a spike that arrives while the page is open (dashboard-design.md
// §4.5) - distinct from AlertBanner, which surfaces the most recent alert from the
// last 24h on load and stays until dismissed. This one only reacts to a live insert
// and disappears on its own.
export default function AlertTicker({ deviceId }) {
  const [alert, setAlert] = useState(null);
  const hideRef = useRef(null);

  useEffect(() => {
    const supabase = getSupabase();
    const channel = supabase
      .channel(`alert-ticker:${deviceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "alerts", filter: `device_id=eq.${deviceId}` },
        ({ new: row }) => {
          if (row.type !== "anomaly") return;
          setAlert(row);
          clearTimeout(hideRef.current);
          hideRef.current = setTimeout(() => setAlert(null), 10_000);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(hideRef.current);
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  if (!alert) return null;

  return (
    <div
      role="status"
      className="animate-ticker-slide sticky top-0 z-20 mb-4 flex items-center gap-3 rounded-md px-4 py-2.5 text-white shadow-lg"
      style={{ background: "var(--lamp-red)" }}
    >
      <span aria-hidden>⚠</span>
      <p className="min-w-0 flex-1 truncate font-bill text-xs uppercase tracking-wide">
        SPIKE · {fmtNum(alert.power_w)} W at {fmtTime(alert.ts)}
      </p>
      <Link href="/alerts" className="shrink-0 font-bill text-xs uppercase tracking-wide underline underline-offset-2">
        View
      </Link>
      <button onClick={() => setAlert(null)} aria-label="Dismiss" className="shrink-0 text-white/80 hover:text-white">
        ✕
      </button>
    </div>
  );
}
