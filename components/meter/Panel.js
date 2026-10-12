// Small bordered panel on the paper surface (dashboard-design.md), used for
// secondary content below a page's main layout. Shared by Overview and Usage
// so both stay on the Meter Room look instead of the old glass Card.
export function Panel({ title, action, children, className = "" }) {
  return (
    <div className={`rounded-md border border-ink/15 p-4 ${className}`}>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="font-bill text-[11px] uppercase tracking-wide text-ink-soft">{title}</p>
        {action}
      </div>
      {children}
    </div>
  );
}
