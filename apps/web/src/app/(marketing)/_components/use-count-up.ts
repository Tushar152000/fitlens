"use client";

import { useEffect, useRef, useState } from "react";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Eases a displayed number from its previous value to `value` (instant under reduced motion). */
export function useCountUp(value: number, ms = 450) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    from.current = value;
    const duration = reducedMotion() ? 0 : ms;
    const t0 = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = duration ? Math.min(1, (t - t0) / duration) : 1;
      setShown(start + (value - start) * (1 - (1 - k) ** 3));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, ms]);

  return shown;
}
