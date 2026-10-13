"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const STATS = [
  { value: 100, suffix: "+", label: "Exercises" },
  { value: 50, suffix: "+", label: "Nutrients tracked" },
  { value: 7, suffix: " days", label: "Of progress at a glance" },
];

/** Purple band: headline, stats that count up when they scroll into view, then the app screens. */
export function Stats() {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.6 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      aria-labelledby="stats-heading"
      className="overflow-hidden bg-fitr8 px-4 pt-16 text-center text-white sm:pt-24"
    >
      <h2
        id="stats-heading"
        className="mx-auto max-w-[17em] text-[32px] leading-[1.15] font-semibold tracking-[-0.025em] text-balance sm:text-[48px]"
      >
        From your first meal to your last rep, and{" "}
        <span className="rounded-[10px] bg-white [box-decoration-break:clone] px-[0.28em] pt-[0.04em] pb-[0.1em] text-fitr8">
          everything in between.
        </span>
      </h2>
      <p className="mx-auto mt-[18px] max-w-[40em] text-[17px] text-white/80">
        Whether you’re cooking at home, eating out, working out at home, or hitting the gym, FITR8
        helps you track it all without breaking your routine.
      </p>
      <div
        ref={ref}
        className="mt-9 inline-flex flex-wrap justify-center gap-x-12 gap-y-3 rounded-[28px] px-6 py-[18px] shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.8)] sm:rounded-full sm:px-10"
      >
        {STATS.map((s) => (
          <Stat key={s.label} {...s} seen={seen} />
        ))}
      </div>
      <Image
        src="/landing/app-screens.png"
        alt="FITR8 app screens: Today, meal log, food detail, plan and progress"
        width={1428}
        height={464}
        sizes="(min-width: 1024px) 980px, 100vw"
        className="mx-auto mt-12 h-auto w-full max-w-[980px] translate-y-2"
      />
    </section>
  );
}

function Stat({ value, suffix, label, seen }: (typeof STATS)[number] & { seen: boolean }) {
  // Shows the real number at rest; counts up from 0 once, when scrolled into view.
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (!seen || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 900);
      setShown(Math.round(value * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, value]);
  return (
    <div className="flex flex-col items-center">
      <span className="text-[36px] leading-tight font-semibold tracking-[-0.03em] tabular-nums sm:text-[44px]">
        {shown}
        {suffix}
      </span>
      <span className="text-[13px] font-semibold tracking-[0.06em] text-white/80 uppercase">
        {label}
      </span>
    </div>
  );
}
