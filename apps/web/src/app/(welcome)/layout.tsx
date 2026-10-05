import { fitr8FontVars } from "@/lib/fitr8-fonts";

/**
 * The FITR8 web welcome flow (Figma "Onboarding 0" / "Onboarding 1"): public, full-width, white.
 * It hands over to sign-in and then the in-app /onboarding.
 */
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${fitr8FontVars} relative min-h-dvh overflow-hidden bg-white font-inter`}>
      {children}
    </div>
  );
}
