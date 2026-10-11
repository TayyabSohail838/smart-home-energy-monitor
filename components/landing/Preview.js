"use client";

import { useState } from "react";

// design.md §3.4. Switches to the dashboard's light-glass look (data-surface
// "app", app/globals.css) as the visual bridge from paper bill to app. Needs
// two real screenshots that don't exist yet — see the note at the bottom of
// this file — so every image degrades to a labelled placeholder until then.
export default function Preview() {
  return (
    <section id="preview" data-surface="app" className="relative overflow-hidden px-4 py-20 md:px-8 md:py-28">
      <h2 className="mx-auto max-w-3xl text-center font-display text-4xl font-black uppercase leading-none text-ink md:text-5xl">
        Your bill, live. Not once a month.
      </h2>

      <div className="relative mx-auto mt-16 w-full max-w-4xl pb-16 md:pb-24">
        {/* Hand-drawn callouts: desktop only — they're annotated against the
            tilted laptop frame, which only exists from md up. */}
        <Callout
          label="Live watts"
          className="left-[2%] top-[6%] hidden -translate-x-full md:block"
          arrow="M60 10 C 30 10, 10 25, 2 55"
          dot={[2, 55]}
        />
        <Callout
          label="This month so far"
          className="right-[2%] top-[6%] hidden translate-x-full md:block"
          arrow="M0 10 C 30 10, 50 25, 58 55"
          dot={[58, 55]}
          flip
        />
        <Callout
          label="Slab meter"
          className="left-[2%] top-1/2 hidden -translate-x-full md:block"
          arrow="M60 20 C 30 20, 10 15, 2 8"
          dot={[2, 8]}
        />

        {/* Laptop frame: Overview screenshot, tilted ~6° on desktop only. */}
        <div className="mx-auto w-full max-w-3xl [perspective:1400px]">
          <div className="glass-strong origin-center overflow-hidden rounded-2xl p-2 shadow-2xl transition-transform md:[transform:rotateY(-6deg)]">
            <div className="overflow-hidden rounded-xl">
              <Screenshot src="/landing/dashboard.png" alt="Wattly dashboard Overview page, seeded data" ratio="16/10" />
            </div>
          </div>
        </div>

        {/* Phone frame: slab-warning alert email. Below the laptop on mobile,
            overlapping its bottom-right corner from md up. */}
        <div className="relative mx-auto mt-6 w-36 md:absolute md:bottom-0 md:right-0 md:mt-0 md:translate-y-1/3 lg:right-2 lg:w-44">
          <div className="glass-strong overflow-hidden rounded-[20px] p-1.5 shadow-xl">
            <div className="overflow-hidden rounded-[14px] bg-white">
              <Screenshot src="/landing/alert-email.png" alt="Slab-warning alert email on a phone" ratio="9/18" />
            </div>
          </div>
        </div>
      </div>

      <p className="mx-auto max-w-3xl text-center font-bill text-xs uppercase tracking-[0.14em] text-ink-2">
        Real dashboard. Real device. Built in 24 hours.
      </p>
    </section>
  );
}

// Loads the real screenshot when it exists; otherwise shows what's missing
// instead of a broken-image icon. Take both after `npm run seed`:
//   public/landing/dashboard.png    — Overview page, seeded data
//   public/landing/alert-email.png — a slab-warning alert email
function Screenshot({ src, alt, ratio }) {
  const [broken, setBroken] = useState(false);
  return (
    <div className="relative w-full bg-[#eef0f3]" style={{ aspectRatio: ratio }}>
      {!broken ? (
        // eslint-disable-next-line @next/next/no-img-element -- static /public asset, no next/image needed
        <img src={src} alt={alt} onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-4 text-center">
          <span className="font-bill text-[10px] uppercase tracking-wide text-ink-3">Screenshot needed</span>
          <span className="font-mono text-[10px] text-ink-3">{src}</span>
        </div>
      )}
    </div>
  );
}

// A short hand-drawn-style arrow (inline SVG) with its label, ending in a dot
// at the point on the frame it's annotating. `flip` mirrors the whole svg
// (path and dot together) for callouts on the right of the frame.
//
// NOTE: `arrow`/`dot` are estimates of where the Overview page's panels sit
// (app/(dashboard)/dashboard/page.js's Card order: live power top-left, bill
// card top-right, the slab meter mid-width, spanning 2 columns). Recheck them
// against the real screenshot once public/landing/dashboard.png exists.
function Callout({ label, arrow, dot, flip, className }) {
  return (
    <div className={`absolute z-10 w-32 text-right ${className}`}>
      <p className="font-bill text-[11px] uppercase tracking-wide text-ink-2">{label}</p>
      <svg viewBox="0 0 64 60" fill="none" className={`ml-auto mt-1 h-10 w-16 text-ink-3 ${flip ? "scale-x-[-1]" : ""}`} aria-hidden>
        <path d={arrow} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx={dot[0]} cy={dot[1]} r="2.2" fill="currentColor" />
      </svg>
    </div>
  );
}
