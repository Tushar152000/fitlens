import Image from "next/image";

const VARIANTS = {
  /** Landing hero + footer: all white (Figma 3788:3998). */
  light: { mark: "/landing/logo-mark.svg", fit: "#ffffff", r8: "#ffffff" },
  /** "Welcome to" screen (3828:3076). */
  welcome: { mark: "/welcome/logo-mark-welcome.svg", fit: "#000600", r8: "var(--color-fitr8)" },
  /** Name step (3830:3137). */
  ink: {
    mark: "/welcome/logo-mark-ink.svg",
    fit: "var(--color-fitr8-ink)",
    r8: "var(--color-fitr8)",
  },
} as const;

/**
 * FITR8 mark + wordmark. Figma sets the wordmark in Rostex, which isn't licensed into the repo yet,
 * so it falls back to Inter ExtraBold until a Rostex font is installed.
 */
export function Fitr8Wordmark({
  size = 22,
  variant = "light",
  className,
}: {
  /** Wordmark font size in px; the mark scales with it (19.1 × 18 at 22, as in the landing page). */
  size?: number;
  variant?: keyof typeof VARIANTS;
  className?: string;
}) {
  const v = VARIANTS[variant];
  const scale = size / 22;
  return (
    <span
      className={`inline-flex items-center ${className ?? ""}`}
      style={{ gap: 4.6 * scale }}
      aria-label="FITR8"
      role="img"
    >
      <Image
        src={v.mark}
        alt=""
        width={Math.round(19.1 * scale)}
        height={Math.round(18 * scale)}
        style={{ width: 19.1 * scale, height: 18 * scale }}
        priority
      />
      <span
        aria-hidden
        className="leading-none font-extrabold tracking-[0.04em] uppercase"
        style={{ fontSize: size, fontFamily: "Rostex, var(--font-inter)" }}
      >
        <span style={{ color: v.fit }}>fit</span>
        <span style={{ color: v.r8 }}>r8</span>
      </span>
    </span>
  );
}
