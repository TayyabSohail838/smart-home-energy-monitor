"use client";

import { useEffect, useRef, useState } from "react";
import { LivePowerChart } from "@/components/charts";
import { AnimatedNumber, Card } from "@/components/ui";
import { fmtNum, timeAgo } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useNow } from "@/lib/useNow";

const WINDOW_MS = 10 * 60 * 1000; // chart shows the last 10 minutes
const STALE_MS = 30 * 1000;       // no reading for 30 s = not live

// Live current and power. Loads the last 10 minutes, then Supabase Realtime pushes
// every new row the ESP32 (or fake device) inserts, with no page refresh.
export default function LivePanel({ deviceId, onReading }) {
  const [points, setPoints] = useState([]);
  const [status, setStatus] = useState("connecting");
  const [flashKey, setFlashKey] = useState(0);
  const now = useNow(1000);
  const onReadingRef = useRef(onReading);
  useEffect(() => {
    onReadingRef.current = onReading;
  }, [onReading]);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("readings")
        .select("ts, power_w, current_a")
        .eq("device_id", deviceId)
        .gte("ts", new Date(Date.now() - WINDOW_MS).toISOString())
        .order("ts", { ascending: true })
        .limit(200);
      if (!cancelled && data) setPoints(data);
    })();

    const channel = supabase
      .channel(`readings:${deviceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "readings", filter: `device_id=eq.${deviceId}` },
        ({ new: row }) => {
          setPoints((prev) =>
            [...prev, { ts: row.ts, power_w: row.power_w, current_a: row.current_a }]
              .sort((a, b) => a.ts.localeCompare(b.ts))
              .filter((p) => Date.parse(p.ts) > Date.now() - WINDOW_MS)
          );
          setFlashKey((k) => k + 1);
          onReadingRef.current?.(row);
        }
      )
      .subscribe((s) => setStatus(s === "SUBSCRIBED" ? "subscribed" : s.toLowerCase()));

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [deviceId]);

  const last = points.at(-1);
  const live = Boolean(last && now && now - Date.parse(last.ts) < STALE_MS);

  return (
    <Card
      delay={60}
      className="lg:col-span-2"
      title="Live power"
      subtitle={status === "subscribed" ? "Realtime · updates every ~10 s" : "Connecting to realtime…"}
      action={
        <span className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs text-ink-2 ring-1 ring-black/5">
          <span className="live-dot" data-state={live ? "live" : "stale"} />
          {live ? "Live" : last && now ? `Last reading ${timeAgo(last.ts, now)}` : "Waiting for device"}
        </span>
      }
    >
      <div key={flashKey} className={`flex flex-wrap items-end gap-x-10 gap-y-3 rounded-2xl ${flashKey ? "animate-flash" : ""}`}>
        <div>
          <p className="text-xs text-ink-3">Power</p>
          <p className="text-5xl font-medium tracking-tight">
            <AnimatedNumber value={last?.power_w ?? null} />
            <span className="ml-1 text-xl text-ink-3">W</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-3">Current</p>
          <p className="text-2xl font-medium">
            <AnimatedNumber value={last?.current_a ?? null} format={(n) => fmtNum(n, 2)} />
            <span className="ml-1 text-sm text-ink-3">A</span>
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-3">Voltage (fixed)</p>
          <p className="text-2xl font-medium">
            230<span className="ml-1 text-sm text-ink-3">V</span>
          </p>
        </div>
      </div>

      <div className="mt-4">
        {points.length > 1 ? (
          <LivePowerChart points={points} />
        ) : (
          <div className="grid h-[140px] place-items-center rounded-2xl border border-dashed border-black/10 text-center text-sm text-ink-3">
            <div>
              No readings in the last 10 minutes.
              <br />
              <span className="text-xs">
                Switch on the device, or run <code className="rounded bg-black/5 px-1">npm run fake-device</code>
              </span>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
