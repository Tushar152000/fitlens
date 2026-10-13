import { marketingFontVars } from "@/lib/fitr8-fonts";

/** Public FITR8 marketing pages: full-width, no session required. Design: docs/WEBSITE.md. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${marketingFontVars} min-h-dvh bg-fitr8-soft font-jakarta text-fitr8-ink antialiased`}
    >
      {children}
    </div>
  );
}
