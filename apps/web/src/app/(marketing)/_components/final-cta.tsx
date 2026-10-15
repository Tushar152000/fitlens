import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ctaArrow, hardButton } from "./cta";
import { AppComingSoon } from "./hero";

/** Closing purple band: one line, Start for free, and "app coming soon". */
export function FinalCta() {
  return (
    <section aria-labelledby="final-heading" className="bg-fitr8 py-14 text-white sm:py-[88px]">
      <div className="mx-auto flex max-w-[1300px] flex-wrap items-center justify-between gap-8 px-4 sm:px-6 lg:px-10">
        <div>
          <h2
            id="final-heading"
            className="max-w-[12em] text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[52px]"
          >
            Your next meal is a good place to start.
          </h2>
          <p className="mt-3.5 text-[17px] text-white/80">
            Free to start. Typing meals and relogging your usuals are always free.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-5">
          <Link href="/welcome" className={`${hardButton} bg-white text-fitr8`}>
            Start for free
            <ArrowRight className={ctaArrow} aria-hidden />
          </Link>
          <AppComingSoon compact />
        </div>
      </div>
    </section>
  );
}
