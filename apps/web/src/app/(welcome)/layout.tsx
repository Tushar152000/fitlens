import { marketingFontVars } from "@/lib/fitr8-fonts";

/** Signed-out onboarding from the website (docs/WEBSITE.md §3), in the landing page's look. */
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${marketingFontVars} min-h-dvh font-jakarta text-fitr8-ink antialiased`}>
      {children}
    </div>
  );
}
