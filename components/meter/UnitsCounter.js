"use client";

// Odometer-style units counter (dashboard-design.md §4.3). Each digit is a
// separate drum; keying a span by its position + character makes React
// remount (and so replay the roll-in animation) only the digits that actually
// changed, not the whole number.
export default function UnitsCounter({ value, projected }) {
  if (value == null) return <div className="skeleton h-[72px] w-44 rounded-md" />;

  const whole = Math.floor(value);
  const digitCount = Math.max(4, String(Math.ceil(projected ?? whole)).length);
  const digits = String(whole).padStart(digitCount, "0").split("");

  return (
    <div>
      <p className="font-bill text-[11px] uppercase tracking-wide text-ink-soft">
        Units this month <span lang="ur" dir="rtl" className="font-urdu text-ink-soft/70">یونٹس</span>
      </p>
      <div className="mt-2 flex gap-1.5" role="img" aria-label={`${whole} units used so far this month`}>
        {digits.map((d, i) => (
          <span key={`${i}-${d}`} className="meter-digit animate-digit-roll font-bill">
            {d}
          </span>
        ))}
      </div>
      {projected != null && (
        <p className="mt-2 font-bill text-xs text-ink-soft">
          PROJECTED <span className="text-ink">{Math.round(projected)}</span> units by month end
        </p>
      )}
    </div>
  );
}
