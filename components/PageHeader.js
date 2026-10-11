"use client";

import { useNow } from "@/lib/useNow";

// Page title row with a live clock in Pakistan time.
export default function PageHeader({ title, subtitle, children }) {
  const now = useNow(30_000);

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-4 animate-fade-up">
      <div>
        <p className="text-xs text-ink-3">
          {now
            ? new Date(now).toLocaleString("en-US", { timeZone: "Asia/Karachi", weekday: "long", day: "numeric", month: "long", hour: "numeric", minute: "2-digit" })
            : " "}
          {" · Faisalabad"}
        </p>
        <h1 className="mt-1 text-2xl font-medium tracking-tight sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
