import Link from "next/link";
import { cn } from "@/lib/cn";
import type { MealType } from "@fitlens/domain/format";

const MODES = [
  { key: "type", label: "Type", href: "/log/type" },
  { key: "photo", label: "Photo", href: "/log" },
  { key: "barcode", label: "Barcode", href: "/log/barcode" },
] as const;

export type LogMode = (typeof MODES)[number]["key"];

/** Design 7: bottom pill tabs to switch how a meal is logged. The current mode is the white pill. */
export function ModeTabs({
  current,
  mealType,
  tone = "dark",
}: {
  current: LogMode;
  mealType: MealType;
  tone?: "dark" | "light";
}) {
  return (
    <nav
      aria-label="How to log"
      className={cn(
        "mx-auto flex w-fit gap-1 rounded-full p-1",
        tone === "dark" ? "bg-white/12" : "bg-chip",
      )}
    >
      {MODES.map((m) => {
        const active = m.key === current;
        return (
          <Link
            key={m.key}
            href={`${m.href}?meal=${mealType}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 min-w-20 items-center justify-center rounded-full px-4 text-sm font-semibold transition-colors",
              active
                ? tone === "dark"
                  ? "bg-white text-ink"
                  : "bg-surface text-ink shadow-seg"
                : tone === "dark"
                  ? "text-white/80 hover:text-white"
                  : "text-ink-2 hover:text-ink",
            )}
          >
            {m.label}
          </Link>
        );
      })}
    </nav>
  );
}
