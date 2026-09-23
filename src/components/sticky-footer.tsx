import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Pins a screen's one primary action to the bottom of the 480 px column. `gutter` matches the screen's side padding. */
export function StickyFooter({
  children,
  gutter = 24,
  className,
}: {
  children: ReactNode;
  gutter?: 20 | 24;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 mt-auto bg-gradient-to-t from-ground from-70% to-transparent pt-6 pb-[max(16px,env(safe-area-inset-bottom))]",
        gutter === 24 ? "-mx-6 px-6" : "-mx-5 px-5",
        className,
      )}
    >
      {children}
    </div>
  );
}
