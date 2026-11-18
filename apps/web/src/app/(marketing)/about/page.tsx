import type { Metadata } from "next";
import { ArrowRight, Dumbbell, LineChart, Utensils } from "lucide-react";
import Link from "next/link";
import { COMPANY_NAME, CONTACT_ADDRESS } from "../_components/contact";
import { PillWord } from "../_components/section-head";
import { SiteFooter } from "../_components/site-footer";
import { SiteHeader } from "../_components/site-header";

export const metadata: Metadata = {
  title: "About us | FITR8",
  description:
    "FITR8 brings nutrition tracking, workout logging and progress tracking together in one app.",
};

/** Each point restates a claim the landing page already makes. */
const POINTS = [
  {
    icon: Utensils,
    title: "Log meals your way",
    body: "Snap a photo, type what you ate, or scan a barcode or label, then confirm.",
  },
  {
    icon: Dumbbell,
    title: "Train with a plan",
    body: "A weekly plan from your goal, experience and equipment.",
  },
  {
    icon: LineChart,
    title: "See your progress",
    body: "Strength, body composition and consistency over time.",
  },
];

/** /about: who we are, what FITR8 does, and the company line. Linked from the header and footer. */
export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main>
        <section aria-labelledby="about-heading" className="py-16 sm:py-24">
          <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
            <p className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-fitr8 uppercase">
              About us
            </p>
            <h1
              id="about-heading"
              className="max-w-[14em] text-[38px] leading-[1.2] font-semibold tracking-[-0.025em] text-balance sm:text-[56px]"
            >
              Eat smarter, train better, <PillWord>see progress.</PillWord>
            </h1>
            <p className="mt-5 max-w-[36em] text-[18px] text-ink-2">
              FITR8 is an all-in-one fitness companion. It brings nutrition tracking, workout
              logging and progress tracking together, so what you eat and how you train inform each
              other and staying consistent gets easier.
            </p>

            <ul className="mt-12 grid gap-4 md:grid-cols-3">
              {POINTS.map(({ icon: Icon, title, body }) => (
                <li key={title} className="flex flex-col gap-4 rounded-[20px] bg-white p-6 sm:p-7">
                  <span className="grid size-12 place-items-center rounded-xl bg-fitr8 text-white shadow-hard-sm">
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <div>
                    <h2 className="text-[20px] font-semibold tracking-[-0.01em]">{title}</h2>
                    <p className="mt-1.5 text-ink-2">{body}</p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-5 rounded-[20px] bg-fitr8-lilac-soft p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
              <div className="text-[15px] text-ink-2">
                <p className="font-semibold text-fitr8-ink">{COMPANY_NAME}</p>
                <address className="mt-1 not-italic">{CONTACT_ADDRESS}</address>
                <p className="mt-1">FITR8 gives general fitness guidance, not medical advice.</p>
              </div>
              <Link
                href="/contact"
                className="group inline-flex h-11 shrink-0 items-center gap-2 self-start rounded-full bg-fitr8 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-brand-hover sm:self-center"
              >
                Contact us
                <ArrowRight
                  className="size-4 transition-transform duration-150 group-hover:translate-x-[3px]"
                  aria-hidden
                />
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
