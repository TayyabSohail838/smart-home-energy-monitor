import Link from "next/link";

// Utility-company bill header: wordmark + Urdu label on the left, account
// actions on the right, closed by a thick ink rule with a dotted one under it.
export default function Header() {
  return (
    <header className="rule-bill">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-8">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-3xl font-black uppercase leading-none tracking-tight md:text-4xl">
            Wattly
          </span>
          <span lang="ur" dir="rtl" className="font-urdu text-base leading-none text-ink-soft md:text-lg">
            بجلی کا بل
          </span>
        </div>

        <nav className="flex items-center gap-4">
          <Link
            href="/login"
            className="font-bill text-xs uppercase tracking-[0.12em] underline-offset-4 hover:underline"
          >
            Log in
          </Link>
          <Link
            href="/login?mode=signup"
            className="rounded-[4px] bg-ink px-4 py-2.5 font-bill text-xs uppercase tracking-[0.12em] text-paper transition hover:opacity-85"
          >
            Get started
          </Link>
        </nav>
      </div>
    </header>
  );
}
