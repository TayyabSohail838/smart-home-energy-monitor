import { Big_Shoulders, Instrument_Sans, Martian_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import Shell from "@/components/Shell";

// The dashboard depends on the logged-in user, so there is no static shell to
// prerender: opt out of Next 16's instant-navigation validation (dev-only check).
export const instant = false;

// Meter-room reskin (dashboard-design.md): the app is paper + instruments now,
// same tokens and fonts as the landing page and login (app/page.js, app/login/page.js).
// Loaded here rather than the root layout so the pre-login routes don't pay for it.
const display = Big_Shoulders({
  variable: "--f-display",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});
const bill = Martian_Mono({ variable: "--f-bill", subsets: ["latin"], display: "swap" });
const body = Instrument_Sans({ variable: "--f-body", subsets: ["latin"], display: "swap" });
const urdu = Noto_Nastaliq_Urdu({ variable: "--f-urdu", subsets: ["arabic"], weight: "400", display: "swap" });

// Every dashboard page (Overview, Usage, Forecast, Alerts) sits inside the breaker-panel shell.
export default function DashboardLayout({ children }) {
  const fonts = `${display.variable} ${bill.variable} ${body.variable} ${urdu.variable}`;
  return (
    <div data-surface="paper" className={`${fonts} min-h-screen font-body`}>
      <Shell>{children}</Shell>
    </div>
  );
}
