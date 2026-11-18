"use client";

import { useEffect, useRef, useState } from "react";

const STATS = [
  { value: 60, suffix: "+", label: "Exercises" },
  { value: 4, suffix: " ways", label: "To log a meal" },
  { value: 7, suffix: " days", label: "Of progress at a glance" },
];

/** Purple band: verifiable product stats that count up when they scroll into view. */
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
      className="overflow-hidden bg-fitr8 px-4 py-16 text-center text-white sm:py-24"
    >
      <h2
        id="stats-heading"
        className="mx-auto max-w-[17em] text-[32px] leading-[1.3] font-semibold tracking-[-0.025em] text-balance sm:text-[48px]"
      >
        From your first meal to your last rep, and{" "}
        <span className="rounded-[10px] bg-white [box-decoration-break:clone] px-[0.28em] pt-[0.04em] pb-[0.1em] text-fitr8">
          everything in between.
        </span>
      </h2>
      <p className="mx-auto mt-5 max-w-[36em] text-[17px] text-white/80">
        Whether you’re cooking at home, eating out, working out at home, or hitting the gym, FITR8
        helps you track it all without breaking your routine.
      </p>
      <div
        ref={ref}
        className="mx-auto mt-12 grid max-w-[880px] divide-y divide-white/15 rounded-[24px] bg-white/10 ring-1 ring-white/20 sm:grid-cols-3 sm:divide-x sm:divide-y-0"
      >
        {STATS.map((s) => (
          <Stat key={s.label} {...s} seen={seen} />
        ))}
      </div>
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
    <div className="flex flex-col items-center gap-1 px-6 py-6 sm:py-8">
      <span className="text-[40px] leading-none font-semibold tracking-[-0.03em] tabular-nums sm:text-[48px]">
        {shown}
        {suffix}
      </span>
      <span className="mt-2 text-[13px] font-semibold tracking-[0.06em] text-white/75 uppercase">
        {label}
      </span>
    </div>
  );
}
