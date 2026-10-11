import BillCard from "@/components/landing/BillCard";

// design.md §3.1. Two columns on desktop (headline left, bill card right);
// stacked on mobile. Static server markup — only the card animates.
export default function Hero() {
  return (
    <section id="hero" className="mx-auto w-full max-w-6xl px-4 pb-16 pt-12 md:px-8 md:pb-24 md:pt-16">
      <div className="grid gap-10 md:grid-cols-2 md:items-center md:gap-8">
        <div>
          <h1 className="font-display text-[52px] font-black leading-[0.95] tracking-tight md:text-[72px] lg:text-[96px]">
            Know your bill before it knows you.
          </h1>
          <p className="mt-6 max-w-md text-[17px] leading-relaxed text-ink-soft md:text-[18px]">
            Wattly clips onto your main wire, tracks every unit live, and warns you before you cross into the
            next slab.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href="/login?mode=signup"
              className="rounded-[4px] bg-ink px-6 py-3.5 font-bill text-sm uppercase tracking-[0.1em] text-paper transition hover:opacity-85"
            >
              Get started
            </a>
            <a
              href="#how-it-works"
              className="font-bill text-sm uppercase tracking-[0.1em] text-ink underline-offset-4 hover:underline"
            >
              See how it works
            </a>
          </div>
        </div>

        <BillCard />
      </div>
    </section>
  );
}
