"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export const SECTIONS = [
  { id: "features", label: "Features" },
  { id: "how", label: "How it works" },
  { id: "numbers", label: "Your numbers" },
  { id: "stories", label: "Results" },
  { id: "faq", label: "FAQ" },
] as const;

/**
 * Section nav as a floating pill pinned to the bottom of the screen. Highlights the section in
 * view; on narrow screens it scrolls sideways and keeps the current item visible.
 */
export function SectionDock() {
  const [active, setActive] = useState<string | null>(null);
  const items = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    // A section counts as current while it crosses the middle of the viewport.
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: "-45% 0px -50% 0px" },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    // Above the first section (the hero) nothing is current.
    const onScroll = () => {
      const first = document.getElementById(SECTIONS[0].id);
      if (first && first.getBoundingClientRect().top > window.innerHeight / 2) setActive(null);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      io.disconnect();
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (active) items.current[active]?.scrollIntoView({ block: "nearest", inline: "center" });
  }, [active]);

  return (
    <nav
      aria-label="Sections"
      className="fixed inset-x-3 bottom-[calc(16px+env(safe-area-inset-bottom))] z-40 flex justify-center motion-safe:animate-[dock-in_400ms_var(--ease-out)_both]"
    >
      <ul className="flex max-w-full [scrollbar-width:none] gap-1 overflow-x-auto rounded-full bg-white/92 p-1.5 shadow-[0_0_0_1px_var(--color-line),var(--shadow-hard-sm)] backdrop-blur-md [&::-webkit-scrollbar]:hidden">
        {SECTIONS.map((s) => (
          <li key={s.id} className="shrink-0">
            <a
              ref={(el) => {
                items.current[s.id] = el;
              }}
              href={`#${s.id}`}
              aria-current={active === s.id ? "location" : undefined}
              className={cn(
                "flex h-10 items-center rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors duration-200 sm:h-11 sm:px-5 sm:text-[15px]",
                active === s.id
                  ? "bg-fitr8 text-white"
                  : "text-fitr8-ink/75 hover:bg-fitr8-soft hover:text-fitr8-ink",
              )}
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
