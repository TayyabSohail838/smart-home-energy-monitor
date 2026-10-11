"use client";

import { useEffect, useRef, useState } from "react";

const STORAGE_KEY = "wattwise-chat";
const SUGGESTIONS = [
  "Why is my bill high this month?",
  "When should I run the iron?",
  "Kya next month bill kam hoga?",
  "Any unusual usage today?",
];

// **bold** and "- " bullet lines; everything else plain text (no HTML injection).
function RichText({ text }) {
  return text.split("\n").map((line, i) => {
    const bullet = /^\s*[-*•]\s+/.test(line);
    const body = bullet ? line.replace(/^\s*[-*•]\s+/, "") : line;
    const parts = body.split(/(\*\*[^*]+\*\*)/g).map((p, j) =>
      p.startsWith("**") && p.endsWith("**") ? <strong key={j} className="font-medium">{p.slice(2, -2)}</strong> : p
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
          className="glass-strong fixed bottom-24 right-4 z-50 flex h-[min(600px,calc(100vh-8rem))] w-[min(400px,calc(100vw-2rem))] flex-col overflow-hidden rounded-[28px] animate-fade-up"
          aria-label="Energy assistant"
        >
          <header className="flex items-center gap-3 border-b border-black/5 px-5 py-4">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-ink text-accent">⚡</span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Ask WattWise</p>
              <p className="text-[11px] text-ink-3">Answers from your live data · Gemini</p>
            </div>
            {messages.length > 0 && (
              <button
                onClick={() => { setMessages([]); setError(null); }}
                className="rounded-full px-2 py-1 text-xs text-ink-3 hover:bg-white hover:text-ink"
              >
                Clear
              </button>
            )}
            <button onClick={() => setOpen(false)} className="rounded-full p-1.5 text-ink-3 hover:bg-white hover:text-ink" aria-label="Close chat">
              ✕
            </button>
          </header>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="animate-fade-up">
                <p className="px-1 text-sm leading-relaxed text-ink-2">
                  Assalam o Alaikum! Ask me about your usage, bill, slabs, alerts or the weather ahead, in English or Urdu.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      className="rounded-full bg-white/80 px-3 py-1.5 text-left text-xs text-ink-2 ring-1 ring-black/5 transition hover:-translate-y-0.5 hover:bg-white hover:text-ink"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex animate-fade-up ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] space-y-1 rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    m.role === "user" ? "rounded-br-md bg-ink text-white" : "rounded-bl-md bg-white/85 text-ink ring-1 ring-black/5"
                  }`}
                  dir="auto"
                >
                  {m.role === "user" ? m.text : <RichText text={m.text} />}
                </div>
              </div>
            ))}

            {busy && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-2xl rounded-bl-md bg-white/85 px-4 py-3 ring-1 ring-black/5" aria-label="Assistant is typing">
                  {[0, 150, 300].map((d) => (
                    <span key={d} className="typing-dot h-1.5 w-1.5 rounded-full bg-ink-3" style={{ animationDelay: `${d}ms` }} />
                  ))}
                </div>
              </div>
            )}

            {error && (
              <p className="rounded-2xl bg-[rgba(208,59,59,0.08)] px-3 py-2 text-xs text-[var(--critical)]">⚠ {error}</p>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="flex items-end gap-2 border-t border-black/5 p-3"
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
              className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl bg-white/80 px-3.5 py-2.5 text-sm outline-none ring-1 ring-black/10 focus:ring-2 focus:ring-ink/30"
            />
            <button
              disabled={busy || !input.trim()}
              className="h-[42px] rounded-2xl bg-ink px-4 text-sm text-white transition hover:opacity-90 disabled:opacity-40"
              aria-label="Send"
            >
              ↑
            </button>
          </form>
        </section>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-5 right-4 z-50 flex items-center gap-2 rounded-full bg-ink px-5 py-3.5 text-sm font-medium text-white shadow-xl transition hover:-translate-y-0.5 hover:shadow-2xl"
        aria-expanded={open}
      >
        <span className="text-accent">{open ? "✕" : "⚡"}</span>
        {open ? "Close" : "Ask WattWise"}
      </button>
    </>
  );
}
