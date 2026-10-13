"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BareMark } from "@/components/logo";
import { cn } from "@/lib/cn";

/**
 * Sticky top bar: purple over the hero, white once scrolled. Logo, Log in and Start for free;
 * the section links live in the bottom dock (SectionDock).
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-[background-color,color,box-shadow] duration-200",
        scrolled
          ? "bg-white/90 text-fitr8-ink shadow-[0_1px_0_var(--color-line)] backdrop-blur-md"
          : "bg-fitr8 text-white",
      )}
    >
      <div className="mx-auto flex h-[72px] max-w-[1300px] items-center gap-6 px-4 sm:px-6 lg:px-10">
        <Link href="/" aria-label="FITR8 home" className="flex items-center gap-2.5">
          <span
            className={cn(
              "grid size-[34px] place-items-center rounded-lg transition-colors",
              scrolled ? "bg-fitr8 text-white" : "text-white",
            )}
          >
            <BareMark className={scrolled ? "w-[19px]" : "w-[26px]"} />
          </span>
          <span className="text-[24px] font-extrabold tracking-[-0.02em]">
            FIT<span className={scrolled ? "text-fitr8" : undefined}>R8</span>
          </span>
        </Link>

        <div className="ml-auto flex items-center gap-2.5">
          <Link
            href="/login"
            className={cn(
              "flex h-11 items-center rounded-full px-3.5 text-[15px] font-semibold transition-colors sm:px-5",
              scrolled
                ? "shadow-[inset_0_0_0_1.5px_var(--color-line)] hover:bg-fitr8-soft"
                : "shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.7)] hover:bg-white/10",
            )}
          >
            Log in
          </Link>
          <Link
            href="/welcome"
            className={cn(
              "hidden h-11 items-center rounded-full px-5 text-[15px] font-semibold shadow-hard-sm transition-[transform,box-shadow] duration-150 hover:-translate-0.5 hover:shadow-hard active:translate-0.5 active:shadow-hard-press min-[360px]:flex",
              scrolled ? "bg-fitr8 text-white" : "bg-white text-fitr8",
            )}
          >
            Start for free
          </Link>
        </div>
      </div>
    </header>
  );
}
