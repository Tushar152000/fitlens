"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** Header links: their own pages. The one matching the current path is marked current. */
const NAV_LINKS = [
  { href: "/about", label: "About us" },
  { href: "/contact", label: "Contact us" },
] as const;

type NavLink = (typeof NAV_LINKS)[number];

function NavAnchor({
  link,
  className,
  onClick,
}: {
  link: NavLink;
  className: string;
  onClick?: () => void;
}) {
  const active = usePathname() === link.href;
  return (
    <Link
      href={link.href}
      className={className}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      data-active={active || undefined}
    >
      {link.label}
    </Link>
  );
}

/** Header links (md+): plain text, the current one underlined. `onBrand` = purple header. */
export function DesktopNav({ onBrand }: { onBrand: boolean }) {
  return (
    <nav aria-label="Site">
      <ul className="flex items-center gap-1">
        {NAV_LINKS.map((link) => (
          <li key={link.href}>
            <NavAnchor
              link={link}
              className={cn(
                "relative flex h-11 items-center px-3.5 text-[15px] font-medium transition-colors data-[active]:font-semibold",
                "after:absolute after:inset-x-3.5 after:bottom-1 after:h-0.5 after:origin-left after:scale-x-0 after:rounded-full after:transition-transform after:duration-200 data-[active]:after:scale-x-100",
                onBrand
                  ? "text-white/85 after:bg-white hover:text-white data-[active]:text-white"
                  : "text-fitr8-ink/75 after:bg-fitr8 hover:text-fitr8 data-[active]:text-fitr8",
              )}
            />
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Header links below md: a menu button that drops a white panel with the same links. */
export function MobileNav({ onBrand }: { onBrand: boolean }) {
  const [open, setOpen] = useState(false);

  // Links close it on click; Escape closes it too.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid size-11 place-items-center rounded-full transition-colors",
          onBrand ? "hover:bg-white/10" : "hover:bg-fitr8-soft",
        )}
      >
        {open ? <X className="size-6" aria-hidden /> : <Menu className="size-6" aria-hidden />}
      </button>
      <nav
        id="site-menu"
        aria-label="Site"
        hidden={!open}
        className="absolute inset-x-0 top-full max-h-[calc(100dvh-72px)] overflow-y-auto border-t border-line bg-white px-4 pt-3 pb-6 text-fitr8-ink shadow-[0_12px_24px_-12px_rgb(21_23_36/0.25)] sm:px-6"
      >
        <ul>
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <NavAnchor
                link={link}
                onClick={close}
                className="flex h-12 items-center rounded-xl px-3.5 text-base font-medium transition-colors hover:bg-fitr8-lilac-soft data-[active]:bg-fitr8-lilac-soft data-[active]:font-semibold data-[active]:text-fitr8"
              />
            </li>
          ))}
        </ul>
        <Link
          href="/login"
          onClick={close}
          className="mt-3 flex h-12 items-center justify-center rounded-full text-base font-semibold shadow-[inset_0_0_0_1.5px_var(--color-line)] hover:bg-fitr8-soft sm:hidden"
        >
          Log in
        </Link>
      </nav>
    </div>
  );
}
