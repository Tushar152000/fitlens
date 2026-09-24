import { cn } from "@/lib/cn";

/**
 * The "Progress lens" mark (docs/DESIGN.md → Brand), drawn from public/brand/mark.svg.
 * Use 24–40 px in the UI. Never recolour or animate the arc.
 */
export function LogoMark({
  size = 32,
  onDark = false,
  title,
  className,
}: {
  size?: number;
  /** On dark grounds the tile is lifted to #2A2C33 so its edge shows. */
  onDark?: boolean;
  title?: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <rect width="512" height="512" rx="116" fill={onDark ? "#2A2C33" : "#17181C"} />
      <circle cx="256" cy="256" r="148" fill="none" stroke="#3A3C43" strokeWidth="60" />
      <circle
        cx="256"
        cy="256"
        r="148"
        fill="none"
        stroke="#E8772E"
        strokeWidth="60"
        strokeLinecap="round"
        strokeDasharray="669.5 260.4"
        transform="rotate(-90 256 256)"
      />
      <circle cx="256" cy="256" r="52" fill="#F6F3EC" />
    </svg>
  );
}

/** Mark + live wordmark "FitLens" (Bricolage Grotesque 700, −0.02em). */
export function Logo({
  size = 32,
  onDark = false,
  className,
}: {
  size?: number;
  onDark?: boolean;
  className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} onDark={onDark} />
      <span
        className={cn(
          "font-display leading-none font-bold tracking-[-0.02em]",
          onDark ? "text-white" : "text-ink",
        )}
        style={{ fontSize: Math.round(size * 0.7) }}
      >
        FitLens
      </span>
    </span>
  );
}
