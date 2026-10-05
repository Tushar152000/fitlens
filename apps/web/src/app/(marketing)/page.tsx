import type { Metadata } from "next";
import { Faq } from "./_components/faq";
import { Features, TrackBand } from "./_components/features";
import { Hero } from "./_components/hero";
import { SiteFooter } from "./_components/site-footer";
import { Stats } from "./_components/stats";
import { Testimonials } from "./_components/testimonials";

export const metadata: Metadata = {
  title: "FITR8 — The world’s #1 nutrition & progress tracking app",
  description:
    "Track your meals, log your workouts, and discover what to do next. Everything you need to reach your fitness goals, all in one place.",
};

/** Public landing page (Figma "FITR8", node 3788:3985). "Start for free" opens the /welcome flow. */
export default function LandingPage() {
  return (
    <>
      <main>
        <Hero />
        <TrackBand />
        <Features />
        <Stats />
        <Testimonials />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
