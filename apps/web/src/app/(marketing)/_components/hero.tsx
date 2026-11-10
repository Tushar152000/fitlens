import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { BareMark } from "@/components/logo";
import { ComingSoon, StoreBadges, storeLinks } from "@/components/store-links";
import { ctaArrow, hardButton } from "./cta";
import { ScanDemo } from "./scan-demo";

/** Hero: headline + CTAs + app download on the left, a live scan of the plate photo on the right. */
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
            <span>Nutrition, workouts</span>
            <span className="rounded-[14px] bg-white px-[0.22em] pt-[0.04em] pb-[0.1em] text-fitr8">
              &amp; progress, together.
            </span>
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
          <GetTheApp className="mt-10" />
        </div>

        <ScanDemo />
      </div>
    </section>
  );
}

/** Store badges once the app is live (APP_STORE_URL / PLAY_STORE_URL); until then, a coming-soon note. */
export function GetTheApp({ className, compact }: { className?: string; compact?: boolean }) {
  if (!storeLinks().live) {
    return compact ? (
      <ComingSoon onBrand className={className} />
    ) : (
      <div className={`flex max-w-[30em] flex-col items-start gap-2.5 ${className ?? ""}`}>
        <ComingSoon onBrand />
        <p className="text-sm text-white/75">
          Start on the web today. Your plan will be waiting in the app for iPhone and Android.
        </p>
      </div>
    );
  }
  return compact ? (
    <StoreBadges shadow className={className} />
  ) : (
    <div className={className}>
      <p className="text-sm font-semibold text-white/80">Get the app</p>
      <StoreBadges shadow className="mt-2.5" />
    </div>
  );
}
