import { Big_Shoulders, Instrument_Sans, Martian_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import Link from "next/link";
import NewPasswordForm from "@/components/auth/NewPasswordForm";

// Where the password-reset email lands (requested from the login page's "Forgot password?").
// Same fonts and paper surface as app/login/page.js.
const display = Big_Shoulders({ variable: "--f-display", subsets: ["latin"], display: "swap", adjustFontFallback: false });
const bill = Martian_Mono({ variable: "--f-bill", subsets: ["latin"], display: "swap" });
const body = Instrument_Sans({ variable: "--f-body", subsets: ["latin"], display: "swap" });
const urdu = Noto_Nastaliq_Urdu({ variable: "--f-urdu", subsets: ["arabic"], weight: "400", display: "swap" });

export const metadata = { title: "Reset password · Wattly" };

export default function ResetPasswordPage() {
  const fonts = `${display.variable} ${bill.variable} ${body.variable} ${urdu.variable}`;
  return (
    <div data-surface="paper" className={`${fonts} min-h-screen font-body`}>
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col px-4 py-6 md:py-10">
        <Link href="/" className="flex items-baseline gap-2.5 self-start">
          <span className="font-display text-2xl font-black uppercase leading-none">Wattly</span>
          <span lang="ur" dir="rtl" className="font-urdu text-sm text-ink-soft">
            بجلی کا بل
          </span>
        </Link>
        <div className="flex flex-1 flex-col justify-center py-10">
          <NewPasswordForm />
        </div>
      </div>
    </div>
  );
}
