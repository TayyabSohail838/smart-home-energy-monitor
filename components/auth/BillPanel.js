import Stamp from "@/components/auth/Stamp";

// login-design.md §4.3. Decorative, static — a smaller echo of the landing
// hero's bill card, so the brand carries across pages. The pitch/bullets are
// real content (readable to screen readers); only the mini stub is decorative.
export default function BillPanel() {
  return (
    <div className="px-6 py-8 lg:flex lg:h-full lg:flex-col lg:justify-center lg:px-14 lg:py-0">
      <div aria-hidden="true" className="relative mx-auto w-fit rotate-[-3deg]">
        <div className="bill-box px-5 py-3">
          <p className="font-bill text-sm tabular text-ink">
            Units <span className="font-semibold">287</span> · Slab{" "}
            <span className="font-semibold">201–300</span> · Projected{" "}
            <span className="font-semibold">Rs 9,500</span>
          </p>
        </div>
        <Stamp tone="red" delay={400} className="absolute -bottom-3 -right-3 px-2.5 py-0.5 text-xs">
          Projected
        </Stamp>
      </div>

      {/* Pitch + bullets: desktop only (login-design.md §3 — the tablet strip
          is the stub alone). */}
      <div className="hidden lg:block">
        <h2 className="mt-10 font-display text-[40px] font-black uppercase leading-[0.95] text-ink">
          Your bill, live.
          <br />
          Not once a month.
        </h2>

        <ul className="mt-6 space-y-2 font-bill text-sm text-ink-soft">
          <li>✓ Live units every 10 seconds</li>
          <li>✓ Email before you cross a slab</li>
          <li>✓ Next month&rsquo;s bill, forecast</li>
        </ul>

        <p className="mt-6 font-bill text-[11px] uppercase tracking-wide text-ink-soft">Sample data.</p>
      </div>
    </div>
  );
}
