import type { Metadata } from "next";
import { Faq } from "./_components/faq";
import { Features } from "./_components/features";
import { FinalCta } from "./_components/final-cta";
import { Hero } from "./_components/hero";
import { SectionDock } from "./_components/section-dock";
import { HowItWorks } from "./_components/how-it-works";
import { SiteFooter } from "./_components/site-footer";
import { SiteHeader } from "./_components/site-header";
import { Stats } from "./_components/stats";
import { TargetCalculator } from "./_components/target-calculator";
import { Testimonials } from "./_components/testimonials";
import { TrackBand } from "./_components/track-band";

export const metadata: Metadata = {
  title: "FITR8 — Nutrition, workouts & progress together",
  description:
    "Track your meals, log your workouts, and discover what to do next. Everything you need to reach your fitness goals, all in one place.",
};

/** Public landing page (docs/WEBSITE.md). "Start for free" opens the /welcome flow. */
export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <TrackBand />
        <Features />
        <HowItWorks />
        <TargetCalculator />
        <Stats />
        <Testimonials />
        <Faq />
        <FinalCta />
      </main>
      <SiteFooter />
      <SectionDock />
    </>
  );
}
