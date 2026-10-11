"use client";

// design-auth.md §4.1. Two tabs styled like the perforated tabs on a bill
// folder, sitting directly above the form slip they control.
const TABS = [
  { mode: "login", label: "Log in" },
  { mode: "signup", label: "New connection" },
];

export default function AuthTabs({ mode, onChange, panelId }) {
  function move(from, dir) {
    const next = TABS[(from + dir + TABS.length) % TABS.length];
    onChange(next.mode);
    document.getElementById(`auth-tab-${next.mode}`)?.focus();
  }

  function handleKeyDown(e, i) {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      move(i, 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      move(i, -1);
    }
  }

  return (
    <div role="tablist" aria-label="Log in or apply for a new connection" className="flex gap-1">
      {TABS.map((t, i) => {
        const active = t.mode === mode;
        return (
          <button
            key={t.mode}
            id={`auth-tab-${t.mode}`}
            role="tab"
            type="button"
            aria-selected={active}
            aria-controls={panelId}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(t.mode)}
            onKeyDown={(e) => handleKeyDown(e, i)}
            className={`font-display rounded-t-[4px] px-5 py-2.5 text-[20px] font-extrabold uppercase leading-none transition-colors ${
              active ? "bg-ink text-paper" : "border-b-2 border-dotted border-rule text-ink-soft hover:text-ink"
            }`}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
