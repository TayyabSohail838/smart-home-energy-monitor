"use client";

import { useEffect, useState } from "react";
import { fmtNum, fmtRs } from "@/lib/format";

// Sample bill shown on the landing page only — no API call (design.md §3.1).
// Numbers are hard-coded but match the real tariff (supabase/tariff.sql) so the
// figure holds up if a judge checks it against the dashboard: 287 units falls
// in slab 201–300, and single_rate mode charges every unit at that slab's rate.
const UNITS = 287;
const SLAB_MIN = 201;
const SLAB_MAX = 300;
const RATE_PER_UNIT = 33.1; // supabase/tariff.sql, slab id 3
const BILL = Math.round(UNITS * RATE_PER_UNIT);
const UNITS_TO_NEXT = SLAB_MAX - UNITS;
const FILL_PCT = ((UNITS - SLAB_MIN) / (SLAB_MAX - SLAB_MIN)) * 100;

// Counts 0 -> target once `active` flips true; jumps straight to the target
// under prefers-reduced-motion, the same rule the dashboard's AnimatedNumber
// follows (components/ui.js), but this one only ever runs once on mount.
function useCountUp(target, { duration, active, reduced }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    if (reduced) {
      const t = setTimeout(() => setValue(target), 0);
      return () => clearTimeout(t);
    }
    const start = performance.now();
    let frame;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      setValue(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, duration, active, reduced]);

  return value;
}

export default function BillCard() {
  const [reduced, setReduced] = useState(false);
  const [countStart, setCountStart] = useState(false); // units + slab bar
  const [billStart, setBillStart] = useState(false); // projected bill
  const [stamped, setStamped] = useState(false); // "PROJECTED" stamp

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => {
        setReduced(true);
        setCountStart(true);
        setBillStart(true);
        setStamped(true);
      }, 0);
      return () => clearTimeout(t);
    }
    // Animation order, design.md §3.1: the card itself fades in via the
    // .bill-card-in CSS animation (0.4s), then units + the slab bar run
    // together (1.0s), then the bill (0.6s), then the stamp thumps in
    // (0.25s) — about 2.2s end to end.
    const t1 = setTimeout(() => setCountStart(true), 400);
    const t2 = setTimeout(() => setBillStart(true), 1400);
    const t3 = setTimeout(() => setStamped(true), 2000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  const units = useCountUp(UNITS, { duration: 1000, active: countStart, reduced });
  const bill = useCountUp(BILL, { duration: 600, active: billStart, reduced });
  const barPct = countStart || reduced ? FILL_PCT : 0;

  return (
    <div className="bill-card-in bill-box relative mx-auto w-full max-w-md">
      <div className="bill-box-head flex flex-wrap items-center justify-between gap-2 rounded-t-[3px] px-5 py-2.5">
        <span className="font-bill text-[11px] uppercase tracking-wide text-ink-soft">Ref no. WTLY-2610-0457</span>
        <span className="font-bill text-[11px] uppercase tracking-wide text-ink-soft">FESCO · Residential</span>
      </div>

      <div className="px-5 py-5">
        <Row label="Units consumed" urdu="یونٹس">
          <span className="tabular font-bill text-[40px] font-semibold md:text-[48px]">{fmtNum(Math.round(units))}</span>
        </Row>

        <Row label="Current slab">
          <span className="tabular font-bill text-lg">
            {SLAB_MIN}–{SLAB_MAX}
          </span>
        </Row>

        <div className="border-t-2 border-dotted border-rule py-4">
          <div className="h-2.5 overflow-hidden rounded-full bg-paper-dark">
            <div
              className="h-full rounded-full transition-[width] duration-[900ms] ease-out"
              style={{ width: `${barPct}%`, backgroundImage: "linear-gradient(to right, var(--usage-blue), var(--ac-orange))" }}
            />
          </div>
          <p className="mt-2 font-bill text-xs uppercase tracking-wide text-ink-soft">{UNITS_TO_NEXT} units to next slab</p>
        </div>

        <Row label="Projected bill">
          <span className="tabular font-bill text-[40px] font-semibold md:text-[48px]">{fmtRs(bill)}</span>
        </Row>
      </div>

      {stamped && (
        <span className="stamp stamp-in absolute -bottom-3 right-4 px-3 py-1 font-bill text-sm">Projected</span>
      )}

      <p className="border-t border-dotted border-rule px-5 py-3 font-bill text-[11px] italic leading-snug text-ink-soft">
        Sample data. Energy charge only, excludes taxes.
      </p>
    </div>
  );
}

function Row({ label, urdu, children }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-t-2 border-dotted border-rule py-3 first:border-t-0 first:pt-0">
      <span className="flex items-baseline gap-2 font-body text-sm text-ink-soft">
        {label}
        {urdu && (
          <span lang="ur" dir="rtl" className="font-urdu text-[15px] text-ink-soft">
            {urdu}
          </span>
        )}
      </span>
      {children}
    </div>
  );
}
