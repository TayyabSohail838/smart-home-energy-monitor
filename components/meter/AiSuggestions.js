"use client";

import { useState } from "react";
import { fmtTime } from "@/lib/format";
import { useApi } from "@/lib/useApi";

// Overview side column, under the status lamps: three AI tips from GET /api/suggestions
// (Gemini + the chatbot's data tools; cached 30 min on the server). Same paper/ink look
// as the lamps and panels.
export default function AiSuggestions() {
  const { data, error, loading, reload } = useApi("/api/suggestions", { refreshMs: 30 * 60 * 1000 });
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    try {
      await fetch("/api/suggestions?refresh=1", { cache: "no-store" });
      await reload();
    } finally {
      setBusy(false);
    }
  }

  const tips = data?.suggestions ?? [];
  const thinking = (loading && !data) || busy;

  return (
    <section aria-label="AI suggestions" className="mt-4 rounded-md border border-ink/15 p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="flex items-center gap-1.5 font-bill text-[10px] uppercase tracking-wide text-ink-soft">
          <span className="text-[var(--lamp-amber)]" aria-hidden>⚡</span>
          AI suggestions
        </p>
        <button
          type="button"
          onClick={refresh}
          disabled={busy}
          className="font-bill text-[10px] uppercase tracking-wide text-ink-soft underline-offset-2 hover:text-ink hover:underline disabled:opacity-40"
        >
          {busy ? "Thinking…" : "Refresh"}
        </button>
      </div>

      {thinking ? (
        <div className="space-y-2.5 py-1" aria-label="Writing suggestions">
          {[0, 1, 2].map((i) => (
            <div key={i} className="space-y-1">
              <div className="skeleton h-2.5 w-1/2 rounded-sm" />
              <div className="skeleton h-2.5 w-full rounded-sm" />
            </div>
          ))}
          <p className="font-bill text-[10px] uppercase tracking-wide text-ink-soft">Reading your data…</p>
        </div>
      ) : error && tips.length === 0 ? (
        <p className="text-xs leading-snug text-ink-soft">⚠ {error}</p>
      ) : (
        <ol className="space-y-2.5">
          {tips.map((t, i) => (
            <li key={i} className="flex gap-2">
              <span className="mt-px font-bill text-[10px] text-ink-soft">{i + 1}</span>
              <span className="min-w-0 text-xs leading-snug text-ink">
                {t.title && <span className="font-semibold">{t.title}: </span>}
                {t.text}
              </span>
            </li>
          ))}
        </ol>
      )}

      {data?.at && !thinking && (
        <p className="mt-3 border-t border-dotted border-ink/20 pt-2 font-bill text-[9.5px] uppercase leading-relaxed tracking-wide text-ink-soft">
          Gemini · from your data · {fmtTime(new Date(data.at).toISOString())}
        </p>
      )}
    </section>
  );
}
