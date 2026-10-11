"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useState } from "react";
import ChatWidget from "@/components/ChatWidget";
import { fmtRs } from "@/lib/format";
import { getSupabase } from "@/lib/supabase/client";
import { useApi } from "@/lib/useApi";

const DeviceContext = createContext(null);
export const useDevice = () => useContext(DeviceContext);

const Icon = {
  overview: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />,
  usage: <path d="M5 20V10m7 10V4m7 16v-7" strokeLinecap="round" />,
  forecast: <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7Z" strokeLinejoin="round" />,
  alerts: <path d="M12 4a5 5 0 0 0-5 5v3l-1.5 3h13L17 12V9a5 5 0 0 0-5-5Zm-2 14a2 2 0 0 0 4 0" strokeLinejoin="round" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />,
  menu: <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />,
  close: <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" />,
};

function Svg({ name, className = "h-[18px] w-[18px]" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      {Icon[name]}
    </svg>
  );
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/usage", label: "Usage", icon: "usage" },
  { href: "/forecast", label: "Forecast", icon: "forecast" },
  { href: "/alerts", label: "Alerts", icon: "alerts" },
];

function Sidebar({ onNavigate, user }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: summary } = useApi("/api/stats/summary", { refreshMs: 60_000 });

  async function logout() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  return (
    <aside className="glass-strong flex h-full w-[260px] flex-col rounded-[28px] p-5">
      <div className="flex items-center gap-2 px-1">
        <span className="grid h-8 w-8 place-items-center rounded-xl bg-ink text-sm text-accent">⚡</span>
        <span className="text-[17px] font-semibold tracking-tight">Wattly</span>
      </div>

      <h1 className="mt-8 px-1 text-[26px] font-medium leading-tight tracking-tight">
        Energy
        <br />
        Overview
      </h1>

      <nav className="mt-7 flex flex-col gap-1">
        {NAV.map((item, i) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              style={{ animationDelay: `${i * 40}ms` }}
              className={`animate-slide-in flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all duration-200 ${
                active ? "bg-white text-ink shadow-sm ring-1 ring-black/5" : "text-ink-2 hover:bg-white/60 hover:text-ink"
              }`}
            >
              <Svg name={item.icon} />
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-accent" />}
            </Link>
          );
        })}
      </nav>

      {/* Insight card */}
      <Link
        href="/forecast"
        onClick={onNavigate}
        className="card-hover mt-6 rounded-3xl bg-white/80 p-4 ring-1 ring-black/5"
      >
        <p className="text-xs font-medium text-ink">This month so far</p>
        <p className="mt-2 text-2xl font-medium tracking-tight">{summary ? fmtRs(summary.bill_so_far) : "…"}</p>
        <p className="mt-1 text-xs leading-relaxed text-ink-3">
          {summary
            ? `Heading for ~${Math.round(summary.projected_month_kwh)} units · ${fmtRs(summary.projected_bill)}`
            : "Loading estimate"}
        </p>
        <p className="mt-3 text-xs font-medium text-ink-2">See forecast →</p>
      </Link>

      <div className="mt-auto flex items-center gap-3 rounded-2xl px-2 pt-6">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-medium text-ink">
          {user?.email?.[0]?.toUpperCase() ?? "·"}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{user?.email}</span>
        <button onClick={logout} className="rounded-full p-2 text-ink-3 hover:bg-white hover:text-ink" title="Log out" aria-label="Log out">
          <Svg name="logout" className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}

// Dashboard frame: loads the user and their device once and shares them.
export default function Shell({ children }) {
  const router = useRouter();
  const [state, setState] = useState({ user: null, device: null, ready: false });
  const [drawer, setDrawer] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return router.replace("/login");
      // RLS returns only this user's device.
      const { data: device } = await supabase.from("devices").select("id, name, link_code").maybeSingle();
      if (!device) return router.replace("/link");
      setState({ user, device, ready: true });
    })();
  }, [router]);

  return (
    <DeviceContext.Provider value={state}>
      <div className="mx-auto flex min-h-screen max-w-[1500px] gap-5 p-3 sm:p-5">
        <div className="sticky top-5 hidden h-[calc(100vh-2.5rem)] lg:block">
          <Sidebar user={state.user} />
        </div>

        {/* Mobile drawer */}
        {drawer && (
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={() => setDrawer(false)}>
            <div className="animate-slide-in h-full p-3" onClick={(e) => e.stopPropagation()}>
              <Sidebar user={state.user} onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <button onClick={() => setDrawer(true)} className="glass rounded-full p-2.5" aria-label="Open menu">
              <Svg name="menu" />
            </button>
            <span className="font-semibold">Wattly</span>
          </div>
          {state.ready ? children : <div className="skeleton h-[60vh] w-full rounded-3xl" />}
        </main>
      </div>
      {state.ready && <ChatWidget />}
    </DeviceContext.Provider>
  );
}
