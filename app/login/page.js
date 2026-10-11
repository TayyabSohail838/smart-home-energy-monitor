import { Big_Shoulders, Instrument_Sans, Martian_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import Link from "next/link";
import AuthForm from "@/components/auth/AuthForm";
import BillPanel from "@/components/auth/BillPanel";

// This route reads `searchParams` directly (for the per-mode <title> and
// initial tab) with no Suspense boundary, so Next 16's Cache Components would
// otherwise refuse to prerender it. We want it rendered per request anyway —
// every visit needs the real query string, not a cached shell — so opt into
// a blocking dynamic render instead of wrapping it in Suspense for no benefit.
export const instant = false;

// Same four families as the landing page (design-auth.md §2: "same tokens,
// fonts and Urdu-label rules as design.md"). next/font dedupes identical
// loader calls across files at build time, so loading them again here is
// normal, not a double download.
const display = Big_Shoulders({
  variable: "--f-display",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false, // see app/page.js — Google renamed this family
});
const bill = Martian_Mono({ variable: "--f-bill", subsets: ["latin"], display: "swap" });
const body = Instrument_Sans({ variable: "--f-body", subsets: ["latin"], display: "swap" });
const urdu = Noto_Nastaliq_Urdu({ variable: "--f-urdu", subsets: ["arabic"], weight: "400", display: "swap" });

// mode comes from the URL, so the <title> can be correct on first load and on
// a shared link, without needing the client to mount first (login-design.md
// §8 accessibility checklist). The form's own tab-switching is pure client
// state afterward — see components/auth/AuthForm.js.
function modeFrom(sp) {
  return sp?.mode === "signup" ? "signup" : "login";
}

export async function generateMetadata({ searchParams }) {
  const signup = modeFrom(await searchParams) === "signup";
  return { title: signup ? "Create account · Wattly" : "Log in · Wattly" };
}

export default async function LoginPage({ searchParams }) {
  const initialMode = modeFrom(await searchParams);
  const fonts = `${display.variable} ${bill.variable} ${body.variable} ${urdu.variable}`;

  return (
    <div data-surface="paper" className={`${fonts} min-h-screen font-body`}>
      <div className="grid min-h-screen lg:grid-cols-[45%_55%]">
        {/* Form column: header strip, tabs + slip, back link. */}
        <div className="flex flex-col px-4 py-6 md:px-8 md:py-10 lg:order-1 lg:px-14">
          <Link href="/" className="flex items-baseline gap-2.5 self-start">
            <span className="font-display text-2xl font-black uppercase leading-none">Wattly</span>
            <span lang="ur" dir="rtl" className="font-urdu text-sm text-ink-soft">
              بجلی کا بل
            </span>
          </Link>

          <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col justify-center py-10">
            <AuthForm initialMode={initialMode} />
            <Link
              href="/"
              className="mt-6 self-start font-bill text-xs uppercase tracking-wide text-ink-soft hover:text-ink"
            >
              ← Back to home
            </Link>
          </div>
        </div>

        {/* Bill panel: hidden on mobile, stub-only strip on tablet (above the
            form, via DOM order), full panel to the right from lg (login-design.md
            §3). */}
        <div className="hidden bg-paper-grain md:block lg:order-2 lg:border-l-2 lg:border-dotted lg:border-rule">
          <BillPanel />
        </div>
      </div>
    </div>
  );
}
