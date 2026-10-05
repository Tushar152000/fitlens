import { ChevronRight, NotebookPen } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { formatInt } from "@fitr8/domain/format";

export type MealRowStatus = "PENDING" | "ANALYZING" | "READY" | "CONFIRMED" | "FAILED";

const STATUS_TEXT: Partial<Record<MealRowStatus, string>> = {
  PENDING: "Reading your plate…",
  ANALYZING: "Reading your plate…",
  READY: "Tap to confirm",
  FAILED: "Couldn't read this one",
};

/** 48 px thumb, "Lunch · 13:15" meta, title, kcal right-aligned. */
export function MealRow({
  href,
  photoUrl,
  meta,
  title,
  kcal,
  status = "CONFIRMED",
}: {
  href: string;
  photoUrl?: string | null;
  meta: string;
  title: string;
  kcal: number;
  status?: MealRowStatus;
}) {
  const note = STATUS_TEXT[status];
  return (
    <Link
      href={href}
      className="flex min-h-16 items-center gap-3 rounded-card bg-surface p-3 transition-colors hover:bg-surface/70"
    >
      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-sunken text-ink-2">
        {photoUrl ? (
          // Signed URLs expire; next/image would cache them under a stale key.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photoUrl} alt="" className="size-full object-cover" />
        ) : (
          <NotebookPen className="size-5" strokeWidth={2} aria-hidden />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[12px] font-semibold text-ink-3">{meta}</span>
        <span className="truncate text-[15px] font-semibold">{title}</span>
        {note && (
          <span
            className={cn(
              "text-[12px] font-semibold",
              status === "READY" ? "text-brand" : "text-ink-3",
            )}
          >
            {note}
          </span>
        )}
      </span>
      {status === "CONFIRMED" ? (
        <span className="shrink-0 text-[15px] font-bold tabular-nums">
          {formatInt(kcal)} <span className="text-[12px] font-semibold text-ink-3">kcal</span>
        </span>
      ) : (
        <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
      )}
    </Link>
  );
}
