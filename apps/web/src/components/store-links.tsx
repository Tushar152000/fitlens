import { Smartphone } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/cn";

/**
 * Store listings, set once the app is published (env APP_STORE_URL, PLAY_STORE_URL; read when the
 * page renders). Until then every "get the app" spot shows "coming soon" instead of badges: Apple's
 * marketing rules allow the App Store badge only for apps that are available.
 */
export function storeLinks() {
  const ios = process.env.APP_STORE_URL || null;
  const android = process.env.PLAY_STORE_URL || null;
  return { ios, android, live: Boolean(ios || android) };
}

/** Linked badges for the stores that are live. */
export function StoreBadges({ className, shadow }: { className?: string; shadow?: boolean }) {
  const { ios, android } = storeLinks();
  const badge = cn(
    "h-[38px] w-auto rounded-[7px]",
    shadow && "shadow-[3px_3px_0_var(--color-fitr8-deep)]",
  );
  return (
    <div className={cn("flex flex-wrap gap-3", className)}>
      {ios && (
        <a href={ios} target="_blank" rel="noreferrer">
          <Image
            src="/landing/badge-app-store.png"
            alt="Download on the App Store"
            width={114}
            height={38}
            className={badge}
          />
        </a>
      )}
      {android && (
        <a href={android} target="_blank" rel="noreferrer">
          <Image
            src="/landing/badge-google-play.png"
            alt="Get it on Google Play"
            width={98}
            height={38}
            className={badge}
          />
        </a>
      )}
    </div>
  );
}

/** "Coming soon" pill used where badges will go. `onBrand` for purple backgrounds. */
export function ComingSoon({ onBrand, className }: { onBrand?: boolean; className?: string }) {
  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold",
        onBrand ? "bg-white/12 text-white" : "bg-fitr8-lilac-soft text-fitr8",
        className,
      )}
    >
      <Smartphone className="size-4" aria-hidden />
      App coming soon to iPhone and Android
    </p>
  );
}
