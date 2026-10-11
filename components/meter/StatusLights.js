"use client";

import Link from "next/link";
import { fmtNum, fmtSlabRange, fmtTime } from "@/lib/format";
import { useNow } from "@/lib/useNow";

const COLOR = { green: "var(--lamp-green)", amber: "var(--lamp-amber)", red: "var(--lamp-red)", off: "var(--lamp-off)" };

// One lamp: a glowing dot + label + one line. Keyed by state so the blink
// (globals.css .animate-lamp-blink) only replays when the state actually
// changes, never on every render (dashboard-design.md §4.5).
function Lamp({ label, state, message, href }) {
  const color = COLOR[state] ?? COLOR.off;
  const Tag = href ? Link : "div";
  return (
    <Tag
      href={href}
      className="flex min-w-[168px] items-start gap-2.5 rounded-md px-1 py-2 lg:min-w-0 lg:px-2 lg:hover:bg-black/[0.03]"
    >
      <span
        key={state}
        aria-hidden
        className="animate-lamp-blink mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
        style={{ background: color, boxShadow: state === "off" ? "none" : `0 0 7px ${color}` }}
      />
      <span className="min-w-0">
        <p className="font-bill text-[10px] uppercase tracking-wide text-ink-soft">{label}</p>
        <p className="mt-0.5 text-xs leading-snug text-ink">{state === "off" ? "NO DATA" : message}</p>
      </span>
    </Tag>
  );
}

// Four status lamps (dashboard-design.md §4.5). Mobile: horizontal scroll row
// above the monitor. Desktop/tablet: stacked beside it.
export default function StatusLights({ lastReadingTs, summary, spikesToday, weatherDay }) {
  const now = useNow(15_000);

  let deviceState = "off";
  let deviceMsg = "NO DATA";
  if (lastReadingTs && now) {
    const ageSec = Math.round((now - Date.parse(lastReadingTs)) / 1000);
    if (ageSec > 300) {
      deviceState = "red";
      deviceMsg = "No reading for 5+ min";
    } else if (ageSec > 60) {
      deviceState = "amber";
      deviceMsg = "No reading for 1+ min";
    } else {
      deviceState = "green";
      deviceMsg = `Online, last reading ${ageSec}s ago`;
    }
  }

  let slabState = "off";
  let slabMsg = "NO DATA";
  if (summary) {
    const { current_slab, next_slab, projected_slab, projected_month_kwh } = summary;
    if (projected_slab.min_units > current_slab.min_units) {
      slabState = "red";
      slabMsg = `Projected into slab ${fmtSlabRange(projected_slab)}`;
    } else if (next_slab && next_slab.min_units - projected_month_kwh <= 20) {
      slabState = "amber";
      slabMsg = `${Math.max(0, Math.ceil(next_slab.min_units - projected_month_kwh))} units from slab ${fmtSlabRange(next_slab)}`;
    } else {
      slabState = "green";
      slabMsg = "Safe this month";
    }
  }

  let spikesState = "off";
  let spikesMsg = "NO DATA";
  if (spikesToday != null) {
    if (spikesToday.length === 0) {
      spikesState = "green";
      spikesMsg = "None today";
    } else {
      spikesState = "red";
      const latest = spikesToday[0];
      spikesMsg = spikesToday.length === 1 ? `1 spike at ${fmtTime(latest.ts)}` : `${spikesToday.length} spikes, most recent ${fmtTime(latest.ts)}`;
    }
  }

  let weatherState = "off";
  let weatherMsg = "NO DATA";
  if (weatherDay) {
    if (weatherDay.temp_max_c >= 32) {
      weatherState = "amber";
      weatherMsg = `${Math.round(weatherDay.temp_max_c)}°C today, AC load expected`;
    } else {
      weatherState = "green";
      weatherMsg = `Mild day, ${fmtNum(weatherDay.temp_max_c, 0)}°C`;
    }
  }

  return (
    <div className="scroll-thin flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0">
      <Lamp label="Device" state={deviceState} message={deviceMsg} />
      <Lamp label="Slab" state={slabState} message={slabMsg} />
      <Lamp label="Spikes" state={spikesState} message={spikesMsg} href="/alerts" />
      <Lamp label="Weather" state={weatherState} message={weatherMsg} href="/forecast" />
    </div>
  );
}
