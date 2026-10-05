import { fitr8FontVars } from "@/lib/fitr8-fonts";

/** Public FITR8 marketing pages: full-width, desktop-first, no session required. */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fitr8FontVars} min-h-dvh bg-white font-inter text-black`}>{children}</div>
  );
}
