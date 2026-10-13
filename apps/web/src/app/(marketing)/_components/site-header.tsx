"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Fitr8Wordmark } from "@/components/fitr8-wordmark";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#results", label: "Results" },
  { href: "#faq", label: "FAQ" },
];

/**
 * Landing navbar (not in the Figma frame). At the top it is transparent and its wordmark sits exactly
 * where Figma puts the hero's (y 50, same left edge); once the page scrolls it turns solid purple so it
 * stays readable over the white sections.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,padding] duration-200 ${
        scrolled ? "bg-fitr8 py-3 shadow-[0_2px_16px_rgba(0,0,0,0.18)]" : "pt-[41px] pb-3"
      }`}
    >
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-[1440px] items-center justify-between gap-6 px-6 lg:px-[15.42%]"
      >
        <Link href="/" aria-label="FITR8 home" className="shrink-0">
          <Fitr8Wordmark />
        </Link>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                className="text-[15px] font-medium text-white/85 transition-colors hover:text-white"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="flex h-10 items-center rounded-full border border-white/80 px-5 font-roboto text-[14px] font-bold tracking-[0.1px] text-white uppercase transition-colors hover:bg-white/10"
          >
            Log in
          </Link>
          <Link
            href="/welcome"
            className="hidden h-10 items-center rounded-full bg-white px-5 font-roboto text-[14px] font-bold tracking-[0.1px] text-fitr8 uppercase sm:flex"
          >
            Start for free
          </Link>
        </div>
      </nav>
    </header>
  );
}
