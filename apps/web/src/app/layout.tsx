import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Analytics } from "@/components/analytics";
import "./globals.css";

// Fonts are files in the repo (src/fonts, Fontsource, OFL): builds never download from Google, which
// failed CI on flaky networks. Variable fonts: one file covers every weight in the range.
const bricolage = localFont({
  src: "../fonts/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});
const figtree = localFont({
  src: "../fonts/figtree-latin-wght-normal.woff2",
  variable: "--font-figtree",
  weight: "300 900",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FITR8 | AI fitness coach",
  description:
    "Snap your meals, hit your goal. Calorie tracking and adaptive workouts for Indian food.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f6f8",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // suppressHydrationWarning here and on forms/inputs: Chrome for iOS injects __gcr* attributes
  // (autofill ids) before React hydrates, and extensions such as Grammarly add data-gr-* to <body>.
  // It only silences attribute mismatches on that element, not its children.
  return (
    <html
      suppressHydrationWarning
      lang="en"
      className={`${bricolage.variable} ${figtree.variable}`}
    >
      <body suppressHydrationWarning className="antialiased">
        {children}
        <Analytics />
      </body>
    </html>
  );
}
