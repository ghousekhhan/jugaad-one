import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./approved-ui.css";

const geist = localFont({ src: "../../node_modules/next/dist/next-devtools/server/font/geist-latin.woff2", weight: "100 900", display: "swap", variable: "--font-geist", adjustFontFallback: false });
const display = localFont({ src: "./fonts/bricolage-grotesque.woff2", weight: "200 800", display: "swap", variable: "--font-display-source", adjustFontFallback: false });
const ui = localFont({ src: "./fonts/instrument-sans.woff2", weight: "400 700", display: "swap", variable: "--font-ui-source", adjustFontFallback: false });
const devanagari = localFont({ src: "./fonts/noto-sans-devanagari.woff2", weight: "100 900", display: "swap", variable: "--font-devanagari", adjustFontFallback: false, preload: false });
const telugu = localFont({ src: "./fonts/noto-sans-telugu.woff2", weight: "100 900", display: "swap", variable: "--font-telugu", adjustFontFallback: false, preload: false });

export const metadata: Metadata = {
  title: { default: "Jugaad One | Say it. Find it. Pay for it.", template: "%s | Jugaad One" },
  description: "Compare offers, review quotes and track simulated orders in one voice-first workspace.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${display.variable} ${ui.variable} ${devanagari.variable} ${telugu.variable} ${geist.variable}`}>
      <body className="approved-ui">
        <a className="skip-link" href="#main">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
