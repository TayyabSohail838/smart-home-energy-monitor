// Centered glass card used by the login and link-device pages.
export default function AuthFrame({ title, subtitle, children }) {
  return (
    <main className="grid min-h-screen place-items-center p-4">
      <div className="glass-strong w-full max-w-md rounded-[32px] p-8 animate-fade-up">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-accent">⚡</span>
          <span className="text-lg font-semibold tracking-tight">Wattly</span>
        </div>
        <h1 className="mt-8 text-3xl font-medium tracking-tight">{title}</h1>
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-ink-2">{subtitle}</p>}
        <div className="mt-7">{children}</div>
      </div>
    </main>
  );
}

export const inputClass =
  "w-full rounded-2xl bg-white/80 px-4 py-3 text-sm outline-none ring-1 ring-black/10 transition focus:ring-2 focus:ring-ink/30";
export const buttonClass =
  "w-full rounded-2xl bg-ink px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50";
