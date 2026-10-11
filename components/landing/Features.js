"use client";

import useInView from "@/components/landing/useInView";

// design.md §3.3. A 2×2 grid (1 column on mobile) of boxed panels, each
// stamping into place as it scrolls into view.
const BOXES = [
  {
    title: "Slab Guard",
    urdu: "سلیب",
    copy: "We email you before you cross into the next slab, not after.",
    visual: <SlabGuardVisual />,
  },
  {
    title: "Spike Alerts",
    urdu: "انتباہ",
    copy: "Iron left on? AC running all night? You'll know.",
    visual: <SpikeVisual />,
  },
  {
    title: "Peak Hours",
    urdu: "یونٹس",
    copy: "See exactly when your home burns the most units.",
    visual: <PeakHoursVisual />,
  },
  {
    title: "Weather Forecast",
    urdu: "موسم",
    copy: "Heatwave coming? We predict next month's units and bill.",
    visual: <WeatherVisual />,
  },
];

export default function Features() {
  return (
    <section id="features" className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-24">
      <h2 className="font-display text-4xl font-black uppercase leading-none md:text-5xl">
        What Wattly watches for you
      </h2>

      <div className="mt-10 grid gap-5 md:grid-cols-2">
        {BOXES.map((box, i) => (
          <Panel key={box.title} index={i} {...box} />
        ))}
      </div>
    </section>
  );
}

function Panel({ title, urdu, copy, visual, index }) {
  const [ref, inView] = useInView();
  return (
    <div
      ref={ref}
      style={{ "--panel-rot": index % 2 === 0 ? "-1.5deg" : "1.5deg", animationDelay: `${index * 80}ms` }}
      className={`bill-box relative overflow-hidden ${inView ? "panel-stamp-in" : "opacity-0"}`}
    >
      <div className="bill-box-head flex items-center justify-between gap-3 px-4 py-2.5">
        <span className="font-display text-base font-extrabold uppercase tracking-wide">{title}</span>
        <span lang="ur" dir="rtl" className="font-urdu text-base text-ink-soft">
          {urdu}
        </span>
      </div>
      <div className="p-5">
        <div className="mb-4 h-16">{visual}</div>
        <p className="text-sm leading-relaxed text-ink-soft">{copy}</p>
      </div>
    </div>
  );
}

// Mini visuals: decorative, sample data only — same rule as the hero bill card.

function SlabGuardVisual() {
  return (
    <div className="relative pt-2">
      <div className="h-2.5 overflow-hidden rounded-full bg-paper-dark">
        <div
          className="h-full w-[78%] rounded-full"
          style={{ backgroundImage: "linear-gradient(to right, var(--usage-blue), var(--ac-orange))" }}
        />
      </div>
      <span className="stamp absolute -top-1 right-0 px-2 py-0.5 text-[10px]">Warning</span>
    </div>
  );
}

function SpikeVisual() {
  return (
    <svg viewBox="0 0 100 40" fill="none" className="h-16 w-full" aria-hidden>
      <path
        d="M0 28 L14 26 L24 29 L34 24 L40 6 L46 24 L58 22 L70 27 L84 23 L100 26"
        stroke="var(--usage-blue)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="40" cy="6" r="6" fill="none" stroke="var(--stamp-red)" strokeWidth="1.6" />
    </svg>
  );
}

function PeakHoursVisual() {
  // 24 hours of sample heights; a late-evening run (18–20) stands out in orange.
  const heights = [20, 18, 15, 14, 16, 22, 34, 46, 40, 36, 38, 42, 44, 40, 38, 44, 52, 66, 86, 96, 78, 58, 42, 30];
  const top3 = [18, 19, 20];
  return (
    <div className="flex h-16 items-end gap-[3px]">
      {heights.map((h, i) => (
        <div
          key={i}
          className="flex-1 rounded-t-[1px]"
          style={{ height: `${h}%`, backgroundColor: top3.includes(i) ? "var(--ac-orange)" : "var(--rule)" }}
        />
      ))}
    </div>
  );
}

function WeatherVisual() {
  return (
    <div className="flex h-16 items-center gap-3">
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--ac-orange)" strokeWidth="1.6" className="h-9 w-9" aria-hidden>
        <circle cx="12" cy="12" r="4.5" />
        <path
          d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"
          strokeLinecap="round"
        />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--stamp-red)" strokeWidth="1.8" className="h-6 w-6" aria-hidden>
        <path d="M5 17 17 5M9 5h8v8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="font-bill text-lg font-bold text-ink">Rs ↑</span>
    </div>
  );
}
