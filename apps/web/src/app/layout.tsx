import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  variable: "--font-bricolage",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});
const figtree = Figtree({
  variable: "--font-figtree",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "FITR8 - AI fitness coach",
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
      </body>
    </html>
  );
}
