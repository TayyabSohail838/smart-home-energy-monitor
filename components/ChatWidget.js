"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "wattly-chat";
const SUGGESTIONS = [
  "Why is my bill high this month?",
  "When should I run the iron?",
  "Kya next month bill kam hoga?",
  "Any unusual usage today?",
];

// Typing indicator: exactly three dots, staggered.
const TYPING_DELAYS_MS = [0, 150, 300];

// Urdu script gets the Nastaliq face (taller line height); Roman Urdu stays in the body font.
const URDU = /[؀-ۿ]/;

// Stroke icons drawn like the breaker nav's (components/meter/BreakerNav.js).
function Icon({ name }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className="h-4 w-4" aria-hidden>
      {name === "bolt" ? (
        <path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z" strokeLinejoin="round" />
      ) : (
        <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />
      )}
    </svg>
  );
}

// **bold** and "- " bullet lines; everything else plain text (no HTML injection).
function RichText({ text }) {
  return text.split("\n").map((line, i) => {
    const bullet = /^\s*[-*•]\s+/.test(line);
    const body = bullet ? line.replace(/^\s*[-*•]\s+/, "") : line;
    const parts = body.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={j} className="font-semibold">{p.slice(2, -2)}</strong> : p
    );
    if (!line.trim()) return <div key={i} className="h-2" />;
    return bullet ? (
      <div key={i} className="flex gap-2"><span aria-hidden>•</span><span>{parts}</span></div>
    ) : (
      <p key={i}>{parts}</p>
    );
  });
}

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
  } catch {
    return [];
  }
}

// Meter Room chat (dashboard-design.md tokens): a bill-box on the paper page
// with a breaker-panel header strip, matching the sidebar and Settings panel.
export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const loaded = useRef(false);

  // Restore the conversation once, after mount (browser-only storage).
  useEffect(() => {
    const t = setTimeout(() => {
      setMessages(loadHistory());
      loaded.current = true;
    }, 0);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30)));
    } catch {}
  }, [messages]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, open]);

  async function send(text) {
    const question = text.trim();
    if (!question || busy) return;
    const next = [...messages, { role: "user", text: question }];
    setMessages(next);
    setInput("");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.slice(-20) }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? "Something went wrong.");
      setMessages([...next, { role: "assistant", text: body.reply }]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {open && (
        <section
          className="bill-box fixed bottom-[8.5rem] right-4 z-50 flex h-[min(600px,calc(100vh-11rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden shadow-2xl animate-fade-up md:bottom-24 md:h-[min(600px,calc(100vh-8rem))]"
          aria-label="Energy assistant"
        >
          {/* Header: a strip of the breaker panel (same body as the sidebar). */}
          <header className="flex items-center gap-3 bg-breaker-body px-4 py-3 text-white">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-[3px] bg-black/40 text-breaker-on">
              <Icon name="bolt" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-bill text-xs uppercase tracking-wide text-paper">Ask Wattly</p>
              <p className="mt-0.5 flex items-center gap-1.5 font-bill text-[9px] uppercase tracking-wide text-white/50">
                <span className={`h-1.5 w-1.5 rounded-full ${busy ? "bg-lamp-amber" : "bg-lamp-green"}`} aria-hidden />
                {busy ? "Reading your meter…" : "Answers from your meter data"}
              </p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null); }}
                className="rounded-md px-2 py-1 font-bill text-[10px] uppercase tracking-wide text-white/50 transition-colors hover:bg-white/5 hover:text-paper"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setOpen(false)}
              className="rounded-md p-1.5 text-white/50 transition-colors hover:bg-white/5 hover:text-paper"
              aria-label="Close chat"
            >
              <Icon name="close" />
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-paper px-4 py-4">
            {messages.length === 0 && (
              <div className="animate-fade-up">
                <p className="text-sm leading-relaxed text-ink-soft">
                  Assalam o Alaikum! Ask me about your usage, bill, slabs, alerts or the weather ahead, in English or Urdu.
                </p>
                <p className="mt-4 font-bill text-[10px] uppercase tracking-wide text-ink-soft">Try asking</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-sm border border-ink/25 bg-paper px-2.5 py-1.5 text-left text-xs text-ink transition-colors hover:border-ink hover:bg-paper-dark"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex animate-fade-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className="max-w-[85%]">
                  <p className={`mb-1 font-bill text-[9px] uppercase tracking-wide text-ink-soft ${m.role === "user" ? "text-right" : ""}`}>
                    {m.role === "user" ? "You" : "Wattly"}
                  </p>
                  <div
                    className={`space-y-1 rounded-sm px-3 py-2 text-sm ${URDU.test(m.text) ? "font-urdu leading-loose" : "leading-relaxed"} ${
                      m.role === "user" ? "bg-ink text-paper" : "border border-ink/20 bg-paper-dark text-ink"
                    }`}
                    dir="auto"
                  >
                    {m.role === "user" ? m.text : <RichText text={m.text} />}
                  </div>
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-sm border border-ink/20 bg-paper-dark px-4 py-3" aria-label="Assistant is typing">
                  {TYPING_DELAYS_MS.map((d) => (
                    <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-soft" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-sm border border-stamp/40 px-3 py-2 text-xs text-stamp">⚠ {error}</p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t-[1.5px] border-ink bg-paper-dark p-3"
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(input);
                }
              }}
              rows={1}
              maxLength={2000}
              placeholder="Ask about your electricity…"
              dir="auto"
              className="max-h-28 min-h-[40px] flex-1 resize-none rounded-sm border border-ink/30 bg-paper px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-soft/70 focus:border-ink"
            />
            <button
              disabled={busy || !input.trim()}
              className="h-[40px] rounded-sm border border-ink bg-ink px-4 font-bill text-xs uppercase tracking-wide text-paper transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              Send
            </button>
          </form>
        </section>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-[4.5rem] right-4 z-50 flex items-center gap-2.5 rounded-md bg-breaker-body px-4 py-3 font-bill text-xs uppercase tracking-wide text-paper shadow-xl ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-2xl md:bottom-5"
        aria-expanded={open}
      >
        <span className="text-breaker-on">
          <Icon name={open ? "close" : "bolt"} />
        </span>
        {open ? "Close" : "Ask Wattly"}
      </button>
    </>
  );
}
