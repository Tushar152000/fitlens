"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const INTERVAL_MS = 1800;

/**
 * The purple pill in "Track ___ at one place". Cycles through `words` every 1.8 s: the new word
 * slides up into place while the pill eases to its width. Holds the first word when the user
 * prefers reduced motion.
 */
export function RotatingWord({ words }: { words: string[] }) {
  const [index, setIndex] = useState(0);
  const [widths, setWidths] = useState<number[]>([]);
  const measure = useRef<HTMLSpanElement>(null);

  // Each word's rendered width (pill padding included), so the pill can animate between them.
  useLayoutEffect(() => {
    const el = measure.current;
    if (!el) return;
    const read = () =>
      setWidths(Array.from(el.children).map((c) => (c as HTMLElement).offsetWidth));
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    return () => ro.disconnect();
  }, [words]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % words.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [words.length]);

  const word = words[index];
  return (
    <>
      <span
        className="relative inline-flex justify-center overflow-hidden rounded-[12px] bg-fitr8 px-[10px] transition-[width] duration-500 ease-out"
        style={widths[index] ? { width: widths[index] } : undefined}
      >
        {/* Screen readers get one stable word, not a change every second. */}
        <span className="sr-only">{words[0]}</span>
        <span
          key={word}
          aria-hidden
          className="inline-block animate-[word-in_500ms_ease-out] whitespace-nowrap"
        >
          {word}
        </span>
      </span>
      {/* Hidden copies used only for measuring, inside a 0 × 0 clipped box so they can't widen the
          page (side by side they're ~520 px, wider than a phone). */}
      <span
        aria-hidden
        className="pointer-events-none invisible absolute top-0 left-0 size-0 overflow-hidden"
      >
        <span ref={measure} className="flex w-max flex-col">
          {words.map((w) => (
            <span key={w} className="w-max px-[10px] whitespace-nowrap">
              {w}
            </span>
          ))}
        </span>
      </span>
    </>
  );
}
