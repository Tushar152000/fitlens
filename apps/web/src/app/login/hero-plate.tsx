import { cn } from "@/lib/cn";

const CHIPS = [
  { label: "Roti", detail: "2 pcs · 211 kcal", className: "top-[8%] -left-1" },
  { label: "Dal tadka", detail: "1 katori · 180 kcal", className: "top-[42%] -right-1" },
  { label: "Jeera rice", detail: "1 katori · 225 kcal", className: "bottom-[6%] left-[6%]" },
];

/** Top-down thali drawn in SVG with detection chips — shows what the app does without a stock photo. */
export function HeroPlate({ className }: { className?: string }) {
  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[320px]", className)}>
      <svg viewBox="0 0 200 200" className="size-full" aria-hidden>
        <circle cx="100" cy="100" r="92" fill="#FFFFFF" />
        <circle cx="100" cy="100" r="92" fill="none" stroke="#E2DDD2" strokeWidth="2" />
        <circle cx="100" cy="100" r="76" fill="none" stroke="#F0EBE1" strokeWidth="2" />

        {/* rotis */}
        <circle cx="70" cy="66" r="30" fill="#E9C58E" />
        <circle cx="70" cy="66" r="30" fill="none" stroke="#D7A968" strokeWidth="1.5" />
        <circle cx="62" cy="58" r="4" fill="#C98F4A" opacity=".55" />
        <circle cx="80" cy="74" r="3" fill="#C98F4A" opacity=".5" />
        <circle cx="70" cy="80" r="2.5" fill="#C98F4A" opacity=".45" />

        {/* dal katori */}
        <circle cx="138" cy="86" r="26" fill="#D9D3C7" />
        <circle cx="138" cy="86" r="21" fill="#E3A13B" />
        <circle cx="132" cy="80" r="3" fill="#2F6B4F" opacity=".7" />
        <circle cx="144" cy="90" r="2" fill="#C2410C" opacity=".6" />

        {/* rice */}
        <ellipse cx="96" cy="140" rx="34" ry="22" fill="#FBF7EE" />
        <ellipse cx="96" cy="140" rx="34" ry="22" fill="none" stroke="#E2DDD2" strokeWidth="1.5" />
        {[
          [84, 134],
          [98, 130],
          [110, 140],
          [90, 148],
          [104, 150],
        ].map(([x, y]) => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" fill="#6B6E76" opacity=".45" />
        ))}

        {/* sabzi */}
        <circle cx="146" cy="138" r="14" fill="#2F6B4F" opacity=".85" />
        <circle cx="142" cy="134" r="4" fill="#E8772E" />
      </svg>

      {CHIPS.map((c) => (
        <div
          key={c.label}
          className={cn(
            "absolute flex flex-col rounded-input border border-line bg-surface px-3 py-1.5",
            c.className,
          )}
        >
          <span className="text-[13px] font-bold">{c.label}</span>
          <span className="text-[12px] font-semibold text-ink-3 tabular-nums">{c.detail}</span>
        </div>
      ))}
    </div>
  );
}
