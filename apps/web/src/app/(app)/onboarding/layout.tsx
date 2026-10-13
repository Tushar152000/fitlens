import { marketingFontVars } from "@/lib/fitr8-fonts";

/** Onboarding, plan and get-the-app screens: full width (desktop rail), website look. */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${marketingFontVars} flex flex-1 flex-col font-jakarta text-fitr8-ink antialiased`}
    >
      {children}
    </div>
  );
}
