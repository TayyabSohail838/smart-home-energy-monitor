import { Big_Shoulders, Instrument_Sans, Martian_Mono, Noto_Nastaliq_Urdu } from "next/font/google";
import Header from "@/components/landing/Header";
import Hero from "@/components/landing/Hero";
import HowItWorks from "@/components/landing/HowItWorks";
import Features from "@/components/landing/Features";
import Preview from "@/components/landing/Preview";
import Slip from "@/components/landing/Slip";

// Loaded here, not in the root layout, so dashboard pages don't download four
// extra families. Exposed as --f-*; app/globals.css maps those to the Tailwind
// font-display / font-bill / font-body / font-urdu utilities.
// Google renamed this family (it was "Big Shoulders Display"), so Next has no
// override metrics for it and warns about that at build time (harmless). The
// fallback comes from the font stack in globals.css instead.
const display = Big_Shoulders({
  variable: "--f-display",
  subsets: ["latin"],
  display: "swap",
  adjustFontFallback: false,
});
const bill = Martian_Mono({ variable: "--f-bill", subsets: ["latin"], display: "swap" });
const body = Instrument_Sans({ variable: "--f-body", subsets: ["latin"], display: "swap" });
// One static weight, arabic subset only: this is used for six short labels.
const urdu = Noto_Nastaliq_Urdu({ variable: "--f-urdu", subsets: ["arabic"], weight: "400", display: "swap" });

const TITLE = "Wattly — know your bill before it knows you";
const DESCRIPTION =
  "Wattly clips onto your main wire, tracks every unit live, and warns you before you cross into the next electricity slab.";

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  // Falls back to no image until public/landing/dashboard.png exists (see
  // components/landing/Preview.js) — a missing OG image is just omitted by
  // link previews, not a broken-image icon.
  openGraph: { title: TITLE, description: DESCRIPTION, type: "website", images: ["/landing/dashboard.png"] },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: ["/landing/dashboard.png"] },
};

export default function LandingPage() {
  const fonts = `${display.variable} ${bill.variable} ${body.variable} ${urdu.variable}`;

  return (
    <div data-surface="paper" className={`${fonts} min-h-screen scroll-smooth font-body`}>
      <Header />
      <Hero />
      <HowItWorks />
      <Features />
      <Preview />
      <Slip />
    </div>
  );
}
