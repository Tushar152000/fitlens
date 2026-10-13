"use client";

import {
  CalendarDays,
  Camera,
  ChevronRight,
  Dumbbell,
  House,
  Keyboard,
  MessageCircle,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/cn";

const NAV = [
  { href: "/today", label: "Today", icon: House, key: "1" },
  { href: "/workout", label: "Workout", icon: Dumbbell, key: "2" },
  { href: "/progress", label: "Progress", icon: TrendingUp, key: "3" },
  { href: "/history", label: "History", icon: CalendarDays, key: "4" },
  { href: "/coach", label: "Coach", icon: MessageCircle, key: "5" },
] as const;

/** Single-key shortcuts, ignored while typing or with a modifier held. */
const SHORTCUTS: Record<string, string> = {
  ...Object.fromEntries(NAV.map((n) => [n.key, n.href])),
  "6": "/profile",
  l: "/log",
  t: "/log/type",
};

function isTyping(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName);
}

function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "grid h-5 min-w-5 place-items-center rounded-md px-1 font-sans text-[11px] font-bold",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

/** Desktop (lg+) navigation: replaces the bottom TabBar with a fixed sidebar. */
export function SideNav({
  name,
  email,
  image,
}: {
  name: string | null;
  email: string | null;
  image: string | null;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || isTyping(e.target)) return;
      // Shortcuts are for the desktop layout; phones have no keyboard to speak of.
      if (!window.matchMedia("(min-width: 64rem)").matches) return;
      const href = SHORTCUTS[e.key.toLowerCase()];
      if (!href) return;
      e.preventDefault();
      router.push(href);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const profileActive = isActive("/profile");
  const display = name ?? email ?? "You";

  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface px-4 pt-7 pb-5 lg:flex">
      <Link href="/today" aria-label="FITR8 home" className="self-start rounded-lg px-2">
        <Logo size={32} />
      </Link>

      <Link
        href="/log"
        className="group mt-8 flex h-12 items-center gap-2.5 rounded-button bg-brand px-4 font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-brand-hover active:scale-[0.98]"
      >
        <Camera className="size-5" aria-hidden />
        <span className="flex-1">Log a meal</span>
        <Kbd className="bg-white/15 text-white">L</Kbd>
      </Link>
      <Link
        href="/log/type"
        className="mt-2 flex h-10 items-center gap-2.5 rounded-button px-4 text-[14px] font-semibold text-ink-2 transition-colors hover:bg-sunken hover:text-ink"
      >
        <Keyboard className="size-[18px]" aria-hidden />
        <span className="flex-1">Type a meal</span>
        <Kbd className="bg-chip text-ink-3">T</Kbd>
      </Link>

      <nav aria-label="Main" className="mt-6">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ href, label, icon: Icon, key }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative flex h-11 items-center gap-3 rounded-button px-4 text-[15px] font-semibold transition-colors duration-150",
                    active ? "bg-brand/8 text-brand" : "text-ink-2 hover:bg-sunken hover:text-ink",
                  )}
                >
                  {active && (
                    <span
                      aria-hidden
                      className="absolute top-2.5 bottom-2.5 -left-4 w-1 rounded-r-full bg-brand"
                    />
                  )}
                  <Icon className="size-5" strokeWidth={2} aria-hidden />
                  <span className="flex-1">{label}</span>
                  <Kbd
                    className={cn(
                      "opacity-0 transition-opacity group-hover:opacity-100",
                      active ? "bg-brand/10 text-brand" : "bg-chip text-ink-3",
                    )}
                  >
                    {key}
                  </Kbd>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <Link
        href="/profile"
        aria-current={profileActive ? "page" : undefined}
        className={cn(
          "mt-auto flex items-center gap-3 rounded-card p-2.5 transition-colors",
          profileActive ? "bg-brand/8" : "hover:bg-sunken",
        )}
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element -- remote avatar from the OAuth provider
          <img
            src={image}
            alt=""
            className="size-10 rounded-full bg-sunken"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ink display text-[16px] text-white">
            {display.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-semibold">{display}</span>
          <span className={cn("text-[12px]", profileActive ? "text-brand" : "text-ink-3")}>
            Profile and settings
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-3" aria-hidden />
      </Link>
    </aside>
  );
}
