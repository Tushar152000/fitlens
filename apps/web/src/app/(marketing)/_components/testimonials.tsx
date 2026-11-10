import Link from "next/link";
import { ArrowRight, MessageCircle } from "lucide-react";
import { SectionHead } from "./section-head";

/** Honest social proof: publish member stories only after receiving and approving real feedback. */
export function Testimonials() {
  return (
    <section id="stories" className="scroll-mt-16 bg-fitr8-lilac-soft py-16 sm:py-28">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
        <SectionHead kicker="Community" title="Your progress story starts here." />
        <div className="mx-auto mt-8 max-w-[760px] rounded-[28px] bg-white p-7 shadow-hard-lg sm:p-12">
          <div className="grid size-12 place-items-center rounded-full bg-fitr8-lilac-soft text-fitr8">
            <MessageCircle className="size-6" aria-hidden />
          </div>
          <h3 className="mt-6 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Help us build FITR8 with real people.
          </h3>
          <p className="mt-4 max-w-[38em] text-base leading-relaxed text-ink-2 sm:text-lg">
            We’re collecting honest feedback from people trying FITR8. Tell us what’s useful, what’s
            confusing, and what you’d like us to improve. With your permission, we may ask to
            feature your feedback here.
          </p>
          <Link
            href="mailto:ask@fitr8.com?subject=FITR8%20feedback"
            className="mt-7 inline-flex items-center gap-2 font-semibold text-fitr8 hover:underline hover:underline-offset-4"
          >
            Share feedback <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </div>
    </section>
  );
}
