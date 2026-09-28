import { CircleAlert } from "lucide-react";

/** Design: form errors sit under the field in ink with an amber icon. */
export function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="flex items-start gap-1.5 text-[13px] font-semibold text-ink">
      <CircleAlert className="mt-px size-4 shrink-0 text-caution" aria-hidden />
      <span>{children}</span>
    </p>
  );
}
