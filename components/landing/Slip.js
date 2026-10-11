// design.md §3.5. The final CTA, styled as a tear-off slip: a dashed "cut
// here" line, then a two-halves slip card (like a bank copy), then a plain
// footer. Server component — no animation.
export default function Slip() {
  return (
    <section id="slip" className="px-4 pb-16 pt-4 md:px-8 md:pb-24">
      {/* Dashed "cut here" line */}
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <ScissorsIcon />
        <span className="whitespace-nowrap font-bill text-[10px] uppercase tracking-[0.18em] text-ink-soft">
          cut here
        </span>
        <div className="h-0 flex-1 border-t-[3px] border-dashed border-rule" />
      </div>

      {/* The slip card: two halves, like a bank copy. */}
      <div className="bill-box relative mx-auto mt-8 w-full max-w-5xl">
        <span lang="ur" dir="rtl" className="absolute right-4 top-4 font-urdu text-base text-ink-soft">
          رسید
        </span>
        {/* inline style, not an opacity-* utility: .stamp's own opacity:0.85 rule
            is defined after Tailwind's utilities in globals.css, so a class
            would lose that cascade fight regardless of markup order. */}
        <span className="stamp absolute bottom-4 right-6 px-3 py-1 font-bill text-sm" style={{ opacity: 0.4 }}>
          Paid
        </span>

        <div className="grid gap-8 p-8 md:grid-cols-2 md:gap-10 md:p-10">
          <div>
            <h2 className="font-display text-4xl font-black uppercase leading-none md:text-5xl">
              Stop paying for surprises.
            </h2>
            <div className="mt-7 flex flex-wrap items-center gap-5">
              <a
                href="/login?mode=signup"
                className="rounded-[4px] bg-ink px-7 py-4 font-bill text-sm uppercase tracking-[0.1em] text-paper transition hover:opacity-85"
              >
                Get started
              </a>
              <a
                href="/login"
                className="font-bill text-sm uppercase tracking-[0.1em] text-ink underline-offset-4 hover:underline"
              >
                Log in
              </a>
            </div>
          </div>

          <div className="border-t-2 border-dotted border-rule pt-8 md:border-l-2 md:border-t-0 md:pl-10 md:pt-0">
            <DetailRow label="Customer" value="You" />
            <DetailRow label="Due date" value="Never late again" />
            <DetailRow label="Amount payable" value="Less than last month" />
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="mx-auto mt-14 flex max-w-5xl flex-wrap items-center justify-center gap-x-3 gap-y-2 text-center">
        <span className="font-display text-base font-black uppercase leading-none">Wattly</span>
        <Dot />
        <span className="font-body text-sm text-ink-soft">Built by Shiza Fatima and Tayyab Sohail at hackathon</span>
        <Dot />
        <a
          href="https://github.com/TayyabSohail838/smart-home-energy-monitor"
          target="_blank"
          rel="noreferrer"
          className="font-body text-sm text-ink underline-offset-4 hover:underline"
        >
          GitHub
        </a>
        <Dot />
        <span className="font-body text-sm text-ink-soft">Team</span>
      </footer>
    </section>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-baseline gap-4 py-1.5 font-bill text-sm">
      <span className="w-32 shrink-0 uppercase tracking-wide text-ink-soft md:w-36">{label}</span>
      <span className="text-ink">{value}</span>
    </div>
  );
}

function Dot() {
  return <span className="text-ink-soft">·</span>;
}

function ScissorsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-4 w-4 shrink-0 text-ink-soft" aria-hidden>
      <circle cx="6" cy="7" r="2.3" />
      <circle cx="6" cy="17" r="2.3" />
      <path d="M7.8 8.3 20 20M7.8 15.7 20 4" strokeLinecap="round" />
    </svg>
  );
}
