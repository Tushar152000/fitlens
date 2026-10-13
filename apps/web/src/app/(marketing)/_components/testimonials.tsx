"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { PillWord, SectionHead } from "./section-head";

// Only Rahul's quote is in Figma; the other four are placeholder reviews for design review.
// Replace all five with real member stories (with consent) before launch: docs/WEBSITE.md.
const STORIES = [
  {
    name: "Rahul Srivastav",
    meta: "Strength and nutrition",
    quote:
      "I used to focus only on my weight. Now I pay attention to my nutrition, strength, and overall progress. It gives me a much clearer picture of my journey.",
  },
  {
    name: "Ananya Iyer",
    meta: "Photo logging",
    quote:
      "Logging a meal is just a photo now. For the first time I’ve kept tracking going past the first week, and my energy through the day feels so much steadier.",
  },
  {
    name: "Meera Kapoor",
    meta: "Half-marathon training",
    quote:
      "I train for half marathons, and FITR8 shows me how my food lines up with my runs. My recovery between long runs feels completely different.",
  },
  {
    name: "Priya Sharma",
    meta: "Barcode scanning",
    quote:
      "Scanning packaged snacks opened my eyes. A few small swaps added up, and I’m down 4 kg without ever feeling like I’m on a diet.",
  },
  {
    name: "Kavya Nair",
    meta: "Workout targets",
    quote:
      "The workout targets keep me honest. Every week I can see my lifts creeping up, and seeing that progress is what keeps me coming back.",
  },
];

const AUTOPLAY_MS = 7000;
const SWAP_MS = 230;

/** One quote at a time; arrows, dots and a slow autoplay that restarts after any manual change. */
export function Testimonials() {
  const [index, setIndex] = useState(0);
  const [shown, setShown] = useState(0);
  const [swapping, setSwapping] = useState(false);
  const [round, setRound] = useState(0);

  const go = useCallback((i: number, manual = false) => {
    setIndex((i + STORIES.length) % STORIES.length);
    if (manual) setRound((r) => r + 1);
  }, []);

  // Fade the old quote out, swap, fade in (instant under reduced motion).
  useEffect(() => {
    if (index === shown) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = requestAnimationFrame(() => setShown(index));
      return () => cancelAnimationFrame(t);
    }
    const raf = requestAnimationFrame(() => setSwapping(true));
    const t = window.setTimeout(() => {
      setShown(index);
      setSwapping(false);
    }, SWAP_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [index, shown]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(
      () => !document.hidden && setIndex((i) => (i + 1) % STORIES.length),
      AUTOPLAY_MS,
    );
    return () => clearInterval(id);
  }, [round]);

  const s = STORIES[shown];
  return (
    <section id="stories" className="scroll-mt-16 bg-fitr8-lilac-soft py-16 sm:py-28">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
        <SectionHead
          kicker="Results"
          title={
            <>
              FITR8 works. Their progress <PillWord>proves it.</PillWord>
            </>
          }
        />
        <div
          aria-roledescription="carousel"
          aria-label="Member stories"
          className="grid items-end gap-6 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <figure className="m-0 flex min-h-[280px] flex-col justify-between gap-6 rounded-[28px] bg-white p-6 shadow-hard-lg sm:p-12">
            <blockquote
              aria-live="polite"
              className={cn(
                "max-w-[26em] text-[22px] leading-[1.4] font-light tracking-[-0.015em] transition-[opacity,transform] duration-200 sm:text-[30px]",
                swapping && "translate-y-2 opacity-0",
              )}
            >
              “{s.quote}”
            </blockquote>
            <figcaption
              className={cn(
                "flex items-center gap-3 transition-[opacity,transform] duration-200",
                swapping && "translate-y-2 opacity-0",
              )}
            >
              <span className="grid size-11 place-items-center rounded-full bg-fitr8 text-lg font-semibold text-white">
                {s.name.charAt(0)}
              </span>
              <span>
                <b className="block font-semibold">{s.name}</b>
                <span className="text-sm text-ink-3">{s.meta}</span>
              </span>
            </figcaption>
          </figure>
          <div className="flex justify-end gap-3.5 sm:flex-col">
            <RoundButton label="Previous story" onClick={() => go(index - 1, true)}>
              <ArrowLeft className="size-[22px]" aria-hidden />
            </RoundButton>
            <RoundButton label="Next story" onClick={() => go(index + 1, true)}>
              <ArrowRight className="size-[22px]" aria-hidden />
            </RoundButton>
          </div>
        </div>
        <div role="group" aria-label="Choose a story" className="mt-5 flex gap-2">
          {STORIES.map((st, i) => (
            <button
              key={st.name}
              type="button"
              aria-label={`Show ${st.name}’s story`}
              aria-current={i === index}
              onClick={() => go(i, true)}
              className={cn(
                "h-2.5 rounded-full transition-[width,background-color] duration-200",
                i === index ? "w-[30px] bg-fitr8" : "w-2.5 bg-fitr8/25 hover:bg-fitr8/45",
              )}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function RoundButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-[52px] place-items-center rounded-full bg-white shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-0.5 hover:shadow-hard active:translate-[3px] active:shadow-[1px_1px_0_var(--color-fitr8-deep)]"
    >
      {children}
    </button>
  );
}
