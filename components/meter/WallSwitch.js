"use client";

// Big wall-switch toggle (dashboard-design.md §7.1), styled like a light
// switch rather than the usual small pill toggle - the same "paddle up = on,
// down = off" idiom as the breaker-panel nav, just bigger and plated.
export default function WallSwitch({ checked, onChange, disabled, label }) {
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="relative h-16 w-9 shrink-0 rounded-md border-2 border-ink bg-paper-dark p-1 disabled:opacity-50"
      >
        <span
          className={`block h-7 w-full rounded-sm bg-ink transition-transform duration-200 ${checked ? "translate-y-0" : "translate-y-[26px]"}`}
          aria-hidden
        />
      </button>
      <p className="font-bill text-sm uppercase tracking-wide text-ink">
        {label} <span className={checked ? "text-ok" : "text-ink-soft"}>{checked ? "ON" : "OFF"}</span>
      </p>
    </div>
  );
}
