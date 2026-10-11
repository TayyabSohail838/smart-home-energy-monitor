import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin"] });

// Resolves relative OG/Twitter image URLs (app/page.js's landing metadata).
// VERCEL_URL is set automatically on Vercel; falls back to localhost for dev.
const siteUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: "Wattly",
  description: "Smart home energy monitor: live usage, bill estimate, alerts and a weather-based forecast.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={`${outfit.variable} h-full antialiased`}>
      <body className="min-h-full font-sans">{children}</body>
    </html>
  );
}
