import { cn } from "@/lib/cn";

/** Page title row: heading, optional lead, actions on the right. */
export function PageHead({
  title,
  lead,
  actions,
}: {
  title: React.ReactNode;
  lead?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="display text-[28px] leading-tight">{title}</h1>
        {lead && <p className="mt-1 text-ink-2">{lead}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("rounded-card border border-line bg-surface p-5", className)}>
      {children}
    </section>
  );
}

export const inputClass =
  "h-12 w-full rounded-input border border-line-strong bg-surface px-3.5 text-[15px] outline-none focus:border-ink disabled:bg-sunken disabled:text-ink-3";
export const textareaClass =
  "w-full rounded-input border border-line-strong bg-surface px-3.5 py-3 text-[15px] outline-none focus:border-ink disabled:bg-sunken";
export const labelClass = "mb-1.5 block text-[13px] font-semibold text-ink-2";
export const smallButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-button border border-line-strong bg-surface px-3.5 text-[14px] font-semibold text-ink transition-colors hover:bg-sunken disabled:cursor-not-allowed disabled:text-ink-3";
export const dangerButton =
  "inline-flex h-10 items-center justify-center gap-2 rounded-button px-3.5 text-[14px] font-semibold text-fat hover:bg-fat/8 disabled:cursor-not-allowed disabled:opacity-50";

/** Labelled field with an optional hint/counter line. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={htmlFor} className={labelClass}>
        {label}
      </label>
      {children}
      {hint && <div className="mt-1 text-[12px] font-semibold text-ink-3">{hint}</div>}
    </div>
  );
}

const STATUS = {
  DRAFT: { label: "Draft", cls: "bg-chip text-ink-2" },
  SCHEDULED: { label: "Scheduled", cls: "bg-water-soft text-water" },
  PUBLISHED: { label: "Published", cls: "bg-protein-soft text-protein" },
} as const;

export function StatusBadge({ status }: { status: keyof typeof STATUS }) {
  const s = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-bold",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}

/** "22 Nov 2026, 14:05" in the viewer's time. */
export function formatWhen(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" }).format(
    new Date(iso),
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-card border border-dashed border-line-strong p-8 text-center text-ink-2">
      {children}
    </p>
  );
}
