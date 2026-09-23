"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Bottom sheet on a native <dialog>: focus trap, Escape to close, backdrop click to close. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className={cn(
        "m-0 mx-auto mt-auto w-full max-w-[480px] rounded-t-sheet bg-surface p-0 text-ink backdrop:bg-ink/50",
        "open:animate-[sheet-in_220ms_var(--ease-out)]",
        className,
      )}
    >
      <div className="flex flex-col gap-4 px-6 pt-3 pb-[max(24px,env(safe-area-inset-bottom))]">
        <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-line-strong" />
        <h2 className="display text-[22px]">{title}</h2>
        {children}
      </div>
    </dialog>
  );
}
