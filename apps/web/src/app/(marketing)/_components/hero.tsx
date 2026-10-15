import { ArrowRight, ChevronDown, Smartphone } from "lucide-react";
import Link from "next/link";
import { BareMark } from "@/components/logo";
import { ctaArrow, hardButton } from "./cta";
import { ScanDemo } from "./scan-demo";

/** Hero: headline + CTAs on the left, a live scan of the plate photo on the right. */
export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-fitr8 pt-6 pb-16 text-white lg:pt-10 lg:pb-24"
    >
      <BareMark className="pointer-events-none absolute -top-[10%] -right-[6%] w-[62%] max-w-[820px] opacity-[0.07]" />
      <div className="relative mx-auto grid max-w-[1300px] items-center gap-10 px-4 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)] lg:gap-16 lg:px-10">
        <div>
          <p className="inline-flex items-center gap-2 rounded-full bg-white/12 py-[7px] pr-3.5 pl-2 text-sm font-semibold">
            <span className="rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold tracking-[0.04em] text-fitr8 uppercase">
              Free
            </span>
            Snap, say, type or scan your meals
          </p>
          <h1 className="mt-6 flex flex-col items-start gap-2.5 text-[42px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[56px] lg:text-[68px]">
            <span>The world’s</span>
            <span className="rounded-[14px] bg-white px-[0.22em] pt-[0.04em] pb-[0.1em] text-fitr8">
              #1 nutrition &amp; progress
            </span>
            <span>tracking app</span>
          </h1>
          <p className="mt-6 max-w-[30em] text-lg text-white/80">
            Track your meals, log your workouts, and discover what to do next. Everything you need
            to reach your fitness goals, all in one place.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
            <Link href="/welcome" className={`${hardButton} bg-white text-fitr8`}>
              Start for free
              <ArrowRight className={ctaArrow} aria-hidden />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center gap-1.5 font-semibold hover:underline hover:underline-offset-4"
            >
              See how it works
              <ChevronDown className="size-5" aria-hidden />
            </a>
          </div>
          <AppComingSoon className="mt-10" />
        </div>

        <ScanDemo />
      </div>
    </section>
  );
}

/** Stands in for the QR code and store badges until FITR8 is published on the App Store and Google Play. */
export function AppComingSoon({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <p
      className={`inline-flex items-center gap-2.5 rounded-full bg-white/12 py-2 pr-4 pl-2 text-sm font-semibold text-white ${className ?? ""}`}
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white text-fitr8">
        <Smartphone className="size-4" aria-hidden />
      </span>
      {compact
        ? "App coming soon on iOS & Android"
        : "The FITR8 app is coming soon to the App Store and Google Play"}
    </p>
  );
}
