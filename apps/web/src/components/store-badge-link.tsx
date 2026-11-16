"use client";

import type { ReactNode } from "react";
import { track } from "@/lib/client/analytics";

/** A store badge link that reports the tap to Analytics (when the visitor allowed it). */
export function StoreBadgeLink({
  href,
  store,
  children,
}: {
  href: string;
  store: "app_store" | "play_store";
  children: ReactNode;
}) {
  return (
    <a href={href} target="_blank" rel="noreferrer" onClick={() => track("store_click", { store })}>
      {children}
    </a>
  );
}
