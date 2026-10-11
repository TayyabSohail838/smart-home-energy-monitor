"use client";

import { useEffect, useRef, useState } from "react";

// Glass card with optional title row. `delay` staggers the entrance animation.
export function Card({ title, subtitle, action, children, className = "", delay = 0, hover = true }) {
  return (
    <section
      className={`glass rounded-3xl p-5 animate-fade-up ${hover ? "card-hover" : ""} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {(title || action) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-[15px] font-medium text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-3">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

// Counts up/down smoothly to `value` whenever it changes.
export function AnimatedNumber({ value, format = (n) => Math.round(n).toLocaleString("en-US"), duration = 700 }) {
  const [shown, setShown] = useState(value ?? 0);
  // Track what is on screen right now, not just where the last finished
  // animation ended: if `value` changes mid-flight the next run has to start
  // from the number the user is currently looking at, or it jumps backwards.
  const from = useRef(value ?? 0);

  useEffect(() => {
    if (value == null) return;
    const start = performance.now();
    const a = from.current;
    let frame;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      from.current = a + (value - a) * eased;
      setShown(from.current);
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return <span className="tabular-nums">{value == null ? "–" : format(shown)}</span>;
}

// A <span> so it can sit inside <p> without breaking hydration.
export function Skeleton({ className = "h-6 w-full" }) {
  return <span className={`skeleton block ${className}`} />;
}

// Segmented control: options = [{ value, label }]
export function Tabs({ options, value, onChange, size = "md" }) {
  return (
    <div className="inline-flex rounded-full bg-white/60 p-1 ring-1 ring-black/5" role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={`rounded-full transition-all duration-200 ${size === "sm" ? "px-3 py-1 text-xs" : "px-4 py-1.5 text-sm"} ${
              active ? "bg-ink text-white shadow-sm" : "text-ink-2 hover:bg-white hover:text-ink"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

const STATUS = {
  critical: { color: "var(--critical)", icon: "⚠", bg: "rgba(208,59,59,0.10)" },
  warning: { color: "#b07800", icon: "▲", bg: "rgba(250,178,25,0.16)" },
  good: { color: "#006300", icon: "✓", bg: "rgba(12,163,12,0.10)" },
  info: { color: "var(--ink-2)", icon: "i", bg: "rgba(20,22,26,0.06)" },
};

// Status pill: always icon + label, never colour alone.
export function Badge({ status = "info", children }) {
  const s = STATUS[status];
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium"
      style={{ color: s.color, background: s.bg }}
    >
      <span aria-hidden>{s.icon}</span>
      {children}
    </span>
  );
}

export function ErrorNote({ message, onRetry }) {
  if (!message) return null;
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-[rgba(208,59,59,0.08)] px-4 py-3 text-sm text-[var(--critical)]">
      <span>⚠ {message}</span>
      {onRetry && (
        <button onClick={onRetry} className="rounded-full bg-white px-3 py-1 text-xs text-ink ring-1 ring-black/10 hover:bg-white/70">
          Retry
        </button>
      )}
    </div>
  );
}

// Small label/value block used inside cards.
export function Stat({ label, children, hint }) {
  return (
    <div>
      <p className="text-xs text-ink-3">{label}</p>
      <p className="mt-1 text-lg font-medium text-ink">{children}</p>
      {hint && <p className="mt-0.5 text-xs text-ink-3">{hint}</p>}
    </div>
  );
}
