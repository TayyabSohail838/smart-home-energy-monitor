"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApi } from "@/lib/useApi";

// Breaker-panel navigation (dashboard-design.md §3). Desktop: a slim vertical
// distribution-board panel on the left. Tablet: the same panel, collapsed to
// icons. Mobile: a bottom bar of the same four breakers, with Settings and
// Log out moved into a header menu (there's no room for a fifth/sixth switch).

const ICON_PATH = {
  overview: <path d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z" />,
  usage: <path d="M5 20V10m7 10V4m7 16v-7" strokeLinecap="round" />,
  forecast: <path d="M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6 11a3.5 3.5 0 0 0 1 7Z" strokeLinejoin="round" />,
  alerts: <path d="M12 4a5 5 0 0 0-5 5v3l-1.5 3h13L17 12V9a5 5 0 0 0-5-5Zm-2 14a2 2 0 0 0 4 0" strokeLinejoin="round" />,
  settings: (
    <path
      d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8-3a7.97 7.97 0 0 0-.15-1.5l2-1.4-1.6-2.77-2.3.9A8 8 0 0 0 15.4 5.4l-.35-2.4h-3.1l-.35 2.4a8 8 0 0 0-2.55 1.43l-2.3-.9-1.6 2.77 2 1.4A7.97 7.97 0 0 0 4 12c0 .51.05 1.01.15 1.5l-2 1.4 1.6 2.77 2.3-.9c.73.62 1.6 1.1 2.55 1.43l.35 2.4h3.1l.35-2.4a8 8 0 0 0 2.55-1.43l2.3.9 1.6-2.77-2-1.4c.1-.49.15-.99.15-1.5Z"
      strokeLinejoin="round"
    />
  ),
  dots: <path d="M6 12h.01M12 12h.01M18 12h.01" strokeLinecap="round" strokeWidth="2.6" />,
  logout: <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10" strokeLinecap="round" strokeLinejoin="round" />,
};

function Svg({ name, className = "h-[17px] w-[17px]" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      {ICON_PATH[name]}
    </svg>
  );
}

const NAV = [
  { href: "/dashboard", label: "Overview", icon: "overview" },
  { href: "/usage", label: "Usage", icon: "usage" },
  { href: "/forecast", label: "Forecast", icon: "forecast" },
  { href: "/alerts", label: "Alerts", icon: "alerts" },
];

// Today's spike count for the Alerts breaker's badge (dashboard-design.md §3).
function useSpikeCount() {
  const { data } = useApi("/api/alerts", { refreshMs: 60_000 });
  if (!data) return 0;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  return data.alerts.filter((a) => a.type === "anomaly" && Date.parse(a.ts) >= start.getTime()).length;
}

// One breaker: a handle (up + lit = on/active) beside an icon + label.
function Breaker({ href, label, icon, active, badge, danger, onClick, compact, delay = 0, horizontal }) {
  const lit = active;
  const Tag = href ? Link : "button";
  return (
    <Tag
      href={href}
      onClick={onClick}
      aria-current={href && active ? "page" : undefined}
      style={{ animationDelay: `${delay}ms` }}
      className={`animate-fade-up group relative flex items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors duration-150 ${
        horizontal ? "flex-1 flex-col gap-1 px-1 py-1.5" : "w-full"
      } ${lit ? "bg-white/5" : "hover:bg-white/5"}`}
    >
      <span
        className={`relative flex shrink-0 flex-col justify-between rounded-[3px] bg-black/40 p-[2px] ${
          horizontal ? "h-5 w-3" : "h-6 w-3.5"
        }`}
        aria-hidden
      >
        <span
          className={`block rounded-[2px] transition-transform duration-[180ms] ${horizontal ? "h-[8px]" : "h-[9px]"} ${
            lit
              ? `translate-y-0 ${danger ? "bg-lamp-red" : "bg-breaker-on"} breaker-handle-on`
              : `${horizontal ? "translate-y-[7px]" : "translate-y-[9px]"} bg-breaker-off breaker-handle-off`
          }`}
        />
      </span>

      <span className={`flex min-w-0 items-center gap-2 ${horizontal ? "flex-col gap-0.5" : "flex-1"}`}>
        <Svg name={icon} className={`h-4 w-4 shrink-0 ${lit ? (danger ? "text-lamp-red" : "text-breaker-on") : "text-white/45"}`} />
        <span
          className={`truncate font-bill uppercase tracking-wide ${horizontal ? "text-[9px]" : "text-[11px]"} ${
            compact ? "lg:hidden" : ""
          } ${lit ? "text-paper" : "text-white/50"}`}
        >
          {label}
        </span>
      </span>

      {badge > 0 && !horizontal && (
        <span className="ml-auto grid h-5 min-w-[20px] shrink-0 place-items-center rounded-full bg-lamp-red px-1 font-bill text-[10px] text-white">
          {badge}
        </span>
      )}
      {badge > 0 && horizontal && (
        <span className="absolute right-2 top-1 h-1.5 w-1.5 rounded-full bg-lamp-red" aria-label={`${badge} new`} />
      )}
    </Tag>
  );
}

function useLogout(router) {
  return async () => {
    const { getSupabase } = await import("@/lib/supabase/client");
    await getSupabase().auth.signOut();
    router.replace("/login");
  };
}

// Desktop (≥1024px: full labels) / tablet (768–1023px: icons + screw-dot panel).
export function SidePanel({ user, device, router }) {
  const pathname = usePathname();
  const spikes = useSpikeCount();
  const logout = useLogout(router);

  return (
    <aside className="relative hidden h-full w-20 shrink-0 flex-col rounded-md bg-breaker-body p-3 text-white md:flex lg:w-[188px]">
      {/* corner screws */}
      <span className="absolute left-2 top-2 h-1.5 w-1.5 rounded-full bg-black/50" aria-hidden />
      <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-black/50 lg:block" aria-hidden />
      <span className="absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full bg-black/50" aria-hidden />
      <span className="absolute bottom-2 right-2 h-1.5 w-1.5 rounded-full bg-black/50 lg:block" aria-hidden />

      <div className="flex flex-col items-center gap-1 px-1 pt-1 lg:items-start">
        <span className="font-display text-lg font-black uppercase leading-none text-paper">
          <span className="lg:hidden">W</span>
          <span className="hidden lg:inline">Wattly</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="hidden max-w-[120px] truncate font-bill text-[10px] text-white/50 lg:inline">{device?.name}</span>
        </span>
      </div>

      <div className="my-3 border-t border-dashed border-white/15" />

      <nav className="flex flex-col gap-1" role="navigation" aria-label="Main">
        {NAV.map((item, i) => (
          <Breaker
            key={item.href}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={pathname.startsWith(item.href)}
            badge={item.href === "/alerts" ? spikes : 0}
            compact
            delay={i * 40}
          />
        ))}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-dashed border-white/15 pt-3">
        <Breaker href="/alerts#settings" label="Settings" icon="settings" active={false} compact />
        <Breaker label="Log out" icon="logout" active={true} danger onClick={logout} compact />
      </div>

      <div className="mt-3 flex items-center gap-2 border-t border-dashed border-white/15 pt-3">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-white/10 font-bill text-[11px] text-white/70">
          {user?.email?.[0]?.toUpperCase() ?? "·"}
        </span>
        <span className="hidden min-w-0 flex-1 truncate font-bill text-[10px] text-white/50 lg:inline">{user?.email}</span>
      </div>
    </aside>
  );
}

// Mobile (<768px) top strip: logo + device dot + a ⋯ menu for Settings/Log out.
export function MobileHeader({ user, device, router }) {
  const [open, setOpen] = useState(false);
  const logout = useLogout(router);

  return (
    <div className="relative mb-4 flex items-center justify-between rounded-md bg-breaker-body px-4 py-2.5 text-white md:hidden">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-lg font-black uppercase leading-none text-paper">Wattly</span>
        <span className="flex items-center gap-1.5">
          <span className="live-dot" />
          <span className="max-w-[140px] truncate font-bill text-[10px] text-white/50">{device?.name}</span>
        </span>
      </div>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="More"
        aria-expanded={open}
        className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
      >
        <Svg name="dots" className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="animate-fade-up absolute right-2 top-full z-50 mt-1.5 w-48 rounded-md bg-breaker-body p-1.5 shadow-xl ring-1 ring-white/10">
            <Link
              href="/alerts#settings"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 rounded-md px-2.5 py-2 font-bill text-[11px] uppercase tracking-wide text-white/70 hover:bg-white/10 hover:text-white"
            >
              <Svg name="settings" className="h-4 w-4" />
              Settings
            </Link>
            <button
              onClick={logout}
              className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 font-bill text-[11px] uppercase tracking-wide text-lamp-red hover:bg-white/10"
            >
              <Svg name="logout" className="h-4 w-4" />
              Log out
            </button>
            <div className="mt-1 border-t border-dashed border-white/15 px-2.5 pt-2">
              <span className="block truncate font-bill text-[10px] text-white/40">{user?.email}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// Mobile (<768px) bottom bar: the same four breakers, thumb-friendly.
export function BottomBar() {
  const pathname = usePathname();
  const spikes = useSpikeCount();

  return (
    <nav
      role="navigation"
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 flex h-14 items-stretch justify-around border-t border-black/10 bg-breaker-body px-1 md:hidden"
    >
      {NAV.map((item) => (
        <Breaker
          key={item.href}
          href={item.href}
          label={item.label}
          icon={item.icon}
          active={pathname.startsWith(item.href)}
          badge={item.href === "/alerts" ? spikes : 0}
          horizontal
        />
      ))}
    </nav>
  );
}
