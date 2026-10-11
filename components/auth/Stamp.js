"use client";

import { useEffect, useState } from "react";

// A rotated ink stamp that thumps into place once (scale 1.4 → 1, slight
// overshoot), reusing the .stamp / .stamp-in rules from app/globals.css that
// the landing page's hero and tear-off slip already use (design.md §3.1/§3.5,
// login-design.md §7). Renders immediately — no thump — once mounted, unless
// `delay` defers it, matching BillCard's own sequencing pattern.
//
// `tone` picks the border/text colour: "red" (warnings, the default), "green"
// (success, e.g. "CONNECTED"), "ink" (neutral), or "blue" (the forecast page's
// STORM advisory, dashboard-design.md §6.4). `faint` fades it further than
// .stamp's own 0.85 baseline, for the "RECEIVED" stamp — an inline style,
// not an opacity-* class: .stamp's opacity rule is defined after Tailwind's
// utilities in globals.css and would win that cascade fight regardless of
// class order (the same trap caught in the landing page's Slip.js).
export default function Stamp({ children, tone = "red", delay = 0, faint = false, className = "" }) {
  const [shown, setShown] = useState(delay === 0);

  useEffect(() => {
    if (delay === 0) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setShown(true), 0);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setShown(true), delay);
    return () => clearTimeout(t);
  }, [delay]);

  if (!shown) return null;

  const toneClass = tone === "green" ? "stamp-ok" : tone === "ink" ? "stamp-ink" : tone === "blue" ? "stamp-blue" : "";
  return (
    <span className={`stamp stamp-in ${toneClass} ${className}`} style={faint ? { opacity: 0.4 } : undefined}>
      {children}
    </span>
  );
}
