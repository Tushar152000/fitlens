"use client";

import { Camera, Dumbbell, ScanBarcode, TrendingUp } from "lucide-react";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { PillWord, SectionHead } from "./section-head";

const FEATURES = [
  {
    icon: Camera,
    title: "Snap it. FITR8 logs it.",
    body: "Take a photo or describe your meal in everyday words. FITR8 identifies foods and portions for you to review and confirm before they’re logged.",
    src: "/landing/feature-snap.png",
    width: 511,
    height: 501,
    note: "Finds every food and portion",
  },
  {
    icon: ScanBarcode,
    title: "Skip the search with a scan",
    body: "Look up packaged food by barcode. When product information is available, review its calories and macros before adding it to your log.",
    src: "/landing/feature-scan.png",
    width: 650,
    height: 520,
    note: "Product details when available",
  },
  {
    icon: Dumbbell,
    title: "Know what to lift next.",
    body: "FITR8 learns from your nutrition and training history to set a personalized target for your next workout.",
    src: "/landing/feature-lift.png",
    width: 650,
    height: 520,
    note: "Next time: +2.5 kg",
  },
  {
    icon: TrendingUp,
    title: "Watch your progress add up.",
    body: "Track your changes over time, from strength gains to body composition, and see how your consistency translates into results.",
    src: "/landing/feature-progress.png",
    width: 650,
    height: 520,
    note: "Weekly trend vs your plan",
  },
] as const;

const AUTOPLAY_MS = 6000;

/**
 * Feature tabs (vertical tablist) beside the matching app screen. Auto-advances while the section
 * is on screen; hover or keyboard focus pauses it; arrow keys move between tabs.
 */
export function Features() {
  const [active, setActive] = useState(0);
  const [progress, setProgress] = useState(0);
  const section = useRef<HTMLElement>(null);
  const paused = useRef(false);
  const visible = useRef(false);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => (visible.current = e.isIntersecting), {
      threshold: 0.3,
    });
    io.observe(el);
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return () => io.disconnect();

    let last = performance.now();
    let elapsed = 0;
    let raf = 0;
    const tick = (t: number) => {
      const dt = t - last;
      last = t;
      if (!paused.current && visible.current && !document.hidden) {
        elapsed += dt;
        if (elapsed >= AUTOPLAY_MS) {
          elapsed = 0;
          setActive((i) => (i + 1) % FEATURES.length);
        }
        setProgress(elapsed / AUTOPLAY_MS);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const reset = () => (elapsed = 0);
    el.addEventListener("fitr8:feature-chosen", reset);
    return () => {
      cancelAnimationFrame(raf);
      io.disconnect();
      el.removeEventListener("fitr8:feature-chosen", reset);
    };
  }, []);

  function choose(i: number, focus = false) {
    setActive(i);
    setProgress(0);
    section.current?.dispatchEvent(new Event("fitr8:feature-chosen"));
    if (focus) tabs.current[i]?.focus();
  }

  const current = FEATURES[active];
  const NoteIcon = current.icon;

  return (
    <section
      id="features"
      ref={section}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
      className="scroll-mt-16 bg-white py-16 sm:py-28"
    >
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
        <SectionHead
          kicker="Features"
          title={
            <>
              Staying fit just got <PillWord>easier.</PillWord>
            </>
          }
          aside="Explore the tools that bring nutrition, training and progress into one routine."
        />
        <div className="grid items-center gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-14">
          <div
            role="tablist"
            aria-label="Features"
            aria-orientation="vertical"
            className="flex flex-col gap-2"
          >
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              const on = i === active;
              return (
                <button
                  key={f.title}
                  ref={(el) => {
                    tabs.current[i] = el;
                  }}
                  type="button"
                  role="tab"
                  id={`feature-tab-${i}`}
                  aria-selected={on}
                  aria-controls="feature-panel"
                  tabIndex={on ? 0 : -1}
                  onClick={() => choose(i)}
                  onKeyDown={(e) => {
                    const d = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[e.key];
                    if (!d) return;
                    e.preventDefault();
                    choose((active + d + FEATURES.length) % FEATURES.length, true);
                  }}
                  className={cn(
                    "relative grid grid-cols-[48px_minmax(0,1fr)] gap-x-4 gap-y-1 overflow-hidden rounded-[20px] px-[18px] py-4 text-left transition-colors",
                    on ? "bg-fitr8-soft" : "hover:bg-fitr8-soft",
                  )}
                >
                  <span
                    className={cn(
                      "row-span-2 grid size-12 place-items-center rounded-[14px] transition-colors",
                      on ? "bg-fitr8 text-white" : "bg-fitr8-lilac-soft text-fitr8",
                    )}
                  >
                    <Icon className="size-6" aria-hidden />
                  </span>
                  <span className="self-center text-[21px] font-semibold tracking-[-0.02em]">
                    {f.title}
                  </span>
                  <span
                    className={cn(
                      "grid text-[15px] text-ink-2 transition-[grid-template-rows] duration-300 ease-out",
                      on ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                    )}
                  >
                    <span className="overflow-hidden">{f.body}</span>
                  </span>
                  {on && (
                    <span
                      aria-hidden
                      className="absolute inset-x-[18px] bottom-0 h-[3px] rounded-full bg-line"
                    >
                      <i
                        className="block h-full rounded-full bg-fitr8"
                        style={{ width: `${progress * 100}%` }}
                      />
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div
            id="feature-panel"
            role="tabpanel"
            aria-labelledby={`feature-tab-${active}`}
            className="relative order-first aspect-[760/640] overflow-hidden rounded-[28px] bg-fitr8-lilac-soft shadow-hard-lg lg:order-none"
          >
            <span className="absolute top-[18px] left-[18px] z-[2] inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[13px] font-semibold text-fitr8 shadow-hard-sm">
              <NoteIcon className="size-[15px]" aria-hidden />
              {current.note}
            </span>
            {FEATURES.map((f, i) => (
              <Image
                key={f.src}
                src={f.src}
                alt={i === active ? `FITR8 app: ${f.title}` : ""}
                width={f.width}
                height={f.height}
                sizes="(min-width: 1024px) 600px, 100vw"
                className={cn(
                  "absolute inset-0 size-full object-contain object-bottom px-7 pt-7 transition-[opacity,transform] duration-[380ms] ease-out",
                  i === active ? "opacity-100" : "translate-y-4 scale-[0.98] opacity-0",
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
