"use client";

import { Camera, Dumbbell, House, TrendingUp, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";

const TABS = [
  { href: "/today", label: "Today", icon: House },
  { href: "/workout", label: "Workout", icon: Dumbbell },
  null, // camera FAB
  { href: "/progress", label: "Progress", icon: TrendingUp },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

/** Five columns with a raised camera button in the middle. Fixed to the bottom of the 480 px column. */
export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-[480px] border-t border-line bg-surface pb-safe"
    >
      <ul className="grid h-[84px] grid-cols-5 items-start pt-2">
        {TABS.map((tab) => {
          if (!tab) {
            return (
              <li key="camera" className="flex justify-center">
                <Link
                  href="/log"
                  aria-label="Log a meal"
                  className="-mt-[26px] grid size-[60px] place-items-center rounded-[20px] bg-brand text-white shadow-fab transition-colors hover:bg-brand-hover"
                >
                  <Camera className="size-6" strokeWidth={2} />
                </Link>
              </li>
            );
          }
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <li key={tab.href} className="flex justify-center">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-11 min-w-14 flex-col items-center gap-1 pt-1 text-[11px] font-semibold",
                  active ? "text-ink" : "text-ink-3 hover:text-ink-2",
                )}
              >
                <Icon className="size-[22px]" strokeWidth={2} aria-hidden />
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
