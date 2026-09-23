import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactElement } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "strong" | "secondary" | "dashed";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "h-[54px] bg-brand text-white hover:bg-brand-hover disabled:bg-brand/50",
  strong: "h-[54px] bg-ink text-white hover:bg-ink/85 disabled:bg-ink/50",
  secondary:
    "h-[54px] border border-line-strong bg-surface text-ink hover:bg-sunken disabled:text-ink-3",
  dashed:
    "h-12 border-[1.5px] border-dashed border-dash bg-transparent text-brand hover:bg-surface/60",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Render the single child (e.g. a Link) with button styles instead of a <button>. */
  asChild?: boolean;
}

export function buttonClass(variant: ButtonVariant = "primary", className?: string) {
  return cn(
    "inline-flex w-full items-center justify-center gap-2 rounded-button px-5 text-base font-semibold",
    "transition-colors duration-150 ease-out select-none disabled:cursor-not-allowed",
    VARIANTS[variant],
    className,
  );
}

export function Button({
  variant = "primary",
  asChild,
  className,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = buttonClass(variant, className);
  if (asChild && isValidElement(children)) {
    const child = children as ReactElement<{ className?: string }>;
    return cloneElement(child, { className: cn(classes, child.props.className) });
  }
  return (
    <button type={type} className={classes} {...props}>
      {children}
    </button>
  );
}
