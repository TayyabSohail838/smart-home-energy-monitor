// design.md §3.2. Styled as the itemised-charges table of a bill: header row
// in --paper-dark, dotted rules between rows, mono numbers, right-aligned
// charge column, a double-ruled total row. Server component — no animation.

const ROWS = [
  {
    n: "01",
    item: "Clip the sensor.",
    detail: "The SCT-013 clamp goes around your main wire. No rewiring.",
    charge: "2 min",
  },
  {
    n: "02",
    item: "ESP32 sends readings.",
    detail: "Every 10 seconds, over your Wi-Fi.",
    charge: "Every 10 s",
  },
  {
    n: "03",
    item: "Cloud crunches it.",
    detail: "Units, slab, spikes, weather forecast.",
    charge: "Instant",
  },
  {
    n: "04",
    item: "You see it live.",
    detail: "Dashboard, plus email alerts before you cross a slab.",
    charge: "Rs 0 surprise",
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto w-full max-w-5xl px-4 py-16 md:px-8 md:py-24">
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="font-bill text-[11px] uppercase tracking-[0.18em] text-ink-soft">Itemised charges</p>
          <h2 className="mt-2 font-display text-4xl font-black uppercase leading-none md:text-5xl">
            How it works
          </h2>
        </div>
        <div className="mt-1 hidden shrink-0 items-center gap-3 text-ink-soft md:flex">
          <ClampIcon />
          <DashboardIcon />
        </div>
      </div>

      {/* Desktop: a real table, header row in paper-dark, dotted rules between rows. */}
      <table className="mt-10 hidden w-full md:table">
        <thead>
          <tr className="bg-paper-dark text-left">
            <th className="w-14 border-b-2 border-ink px-4 py-3 font-bill text-xs uppercase tracking-wide text-ink-soft">
              #
            </th>
            <th className="border-b-2 border-ink px-4 py-3 font-bill text-xs uppercase tracking-wide text-ink-soft">
              Item
            </th>
            <th className="w-40 border-b-2 border-ink px-4 py-3 text-right font-bill text-xs uppercase tracking-wide text-ink-soft">
              Charge
            </th>
          </tr>
        </thead>
        <tbody className="divide-y-2 divide-dotted divide-rule">
          {ROWS.map((r) => (
            <tr key={r.n}>
              <td className="px-4 py-5 align-top font-bill text-sm text-ink-soft">{r.n}</td>
              <td className="px-4 py-5 align-top leading-relaxed">
                <span className="font-semibold">{r.item}</span> {r.detail}
              </td>
              <td className="px-4 py-5 align-top text-right font-bill text-sm uppercase tracking-wide text-ink-soft">
                {r.charge}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} className="border-t-[6px] border-double border-ink px-4 py-5 text-right font-bill text-sm font-bold uppercase tracking-wide">
              Total effort: one clip-on.
            </td>
          </tr>
        </tfoot>
      </table>

      {/* Mobile: stacked rows — number + item on top, charge below, right-aligned. */}
      <div className="mt-10 border-t-2 border-dotted border-rule md:hidden">
        <div className="divide-y-2 divide-dotted divide-rule">
          {ROWS.map((r) => (
            <div key={r.n} className="py-4">
              <p className="font-bill text-xs uppercase tracking-wide text-ink-soft">{r.n}</p>
              <p className="mt-1.5 leading-relaxed">
                <span className="font-semibold">{r.item}</span> {r.detail}
              </p>
              <p className="mt-2 text-right font-bill text-sm uppercase tracking-wide text-ink-soft">{r.charge}</p>
            </div>
          ))}
        </div>
        <p className="border-t-[6px] border-double border-ink py-4 text-right font-bill text-sm font-bold uppercase tracking-wide">
          Total effort: one clip-on.
        </p>
      </div>
    </section>
  );
}

// Minimal line icons, same stroke convention as components/Shell.js's Svg.
function ClampIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-7 w-7" aria-hidden>
      <path d="M4 12h5" strokeLinecap="round" />
      <path d="M9 7a5 5 0 1 1 0 10" strokeLinecap="round" />
      <rect x="15" y="9" width="6" height="6" rx="1" />
    </svg>
  );
}
function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-7 w-7" aria-hidden>
      <rect x="3.5" y="5" width="17" height="11" rx="1.5" />
      <path d="M8 20h8M12 16v4" strokeLinecap="round" />
      <path d="M7 12l2.5-3 2 2L16 7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
