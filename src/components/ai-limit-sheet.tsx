"use client";

import { Crown, Keyboard } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";
import { cn } from "@/lib/cn";
import type { MealType } from "@/lib/format";

export interface ScanUsage {
  used: number;
  limit: number;
  left: number;
  resetsAt: string;
}

/** Design 9c: shown on HTTP 429 from a photo scan. Typing a meal is always free. */
export function AiLimitSheet({
  open,
  onClose,
  mealType,
  usage,
}: {
  open: boolean;
  onClose: () => void;
  mealType: MealType;
  usage: ScanUsage | null;
}) {
  const [proNote, setProNote] = useState(false);
  const limit = usage?.limit ?? 3;
  const used = Math.min(usage?.used ?? limit, limit);
  const pips = Math.min(limit, 10); // one pip per scan; scaled past 10 so they stay readable
  const usedPips = Math.min(pips, Math.round((used / limit) * pips));
  const resets = usage
    ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(
        new Date(usage.resetsAt),
      )
    : "midnight";

  return (
    <Sheet open={open} onClose={onClose} title={`You've used today's ${limit} free photo scans`}>
      <div
        className="flex gap-1.5"
        role="img"
        aria-label={`${used} of ${limit} photo scans used today`}
      >
        {Array.from({ length: pips }, (_, i) => (
          <span
            key={i}
            className={cn("h-2 flex-1 rounded-full", i < usedPips ? "bg-brand" : "bg-track")}
          />
        ))}
      </div>
      <p className="text-ink-2">
        Scans reset at {resets}. Typing a meal is free and doesn&apos;t use a scan.
      </p>

      <div className="flex flex-col gap-2 rounded-card bg-ink p-4 text-white">
        <p className="flex items-center gap-2 font-bold">
          <Crown className="size-5 text-brand-glow" aria-hidden />
          FitLens Pro
        </p>
        <p className="text-[13px] text-white/75">
          Unlimited photo scans, label reading and weekly coaching.
        </p>
        <p className="display text-[22px] tabular-nums">
          [PRICE] <span className="text-[13px] font-semibold text-white/70">/ month</span>
        </p>
      </div>

      <Button onClick={() => setProNote(true)}>Upgrade to Pro</Button>
      {proNote && (
        <p role="status" className="-mt-2 text-center text-[13px] text-ink-3">
          Pro isn&apos;t available yet. Typing your meal works now.
        </p>
      )}
      <Button asChild variant="secondary">
        <Link href={`/log/type?meal=${mealType}`}>
          <Keyboard className="size-5" aria-hidden />
          Type my meal instead
        </Link>
      </Button>
    </Sheet>
  );
}
