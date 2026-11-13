"use client";

import { GoogleAnalytics } from "@next/third-parties/google";
import Link from "next/link";
import { GA_ID, setConsent, useConsent } from "@/lib/client/analytics";

/**
 * Loads Google Analytics only after the visitor accepts; until they choose, a small banner asks.
 * Renders nothing when no Measurement ID is configured.
 */
export function Analytics() {
  const consent = useConsent();
  if (!GA_ID || consent === undefined) return null;
  if (consent === "granted") return <GoogleAnalytics gaId={GA_ID} />;
  if (consent === "denied") return null;
  return (
    <div
      role="region"
      aria-label="Analytics cookies"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-[520px] rounded-card border border-line bg-surface p-4 shadow-[0_8px_32px_rgba(20,20,40,0.12)]"
    >
      <p className="text-sm text-ink-2">
        We&apos;d like to use Google Analytics cookies to see how people use FITR8 and improve it.
        No health data is shared.{" "}
        <Link href="/privacy" className="font-semibold text-brand">
          Privacy
        </Link>
      </p>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => setConsent("denied")}
          className="h-10 flex-1 rounded-button border border-line-strong bg-surface text-sm font-semibold text-ink hover:bg-sunken"
        >
          No thanks
        </button>
        <button
          type="button"
          onClick={() => setConsent("granted")}
          className="h-10 flex-1 rounded-button bg-ink text-sm font-semibold text-white hover:bg-ink/85"
        >
          Allow
        </button>
      </div>
    </div>
  );
}

/** For the privacy page: lets a visitor change their earlier choice. */
export function AnalyticsChoice() {
  const consent = useConsent();
  if (!GA_ID || consent === undefined) return null;
  return (
    <p>
      Analytics cookies are currently <b>{consent === "granted" ? "on" : "off"}</b> in this
      browser.{" "}
      <button
        type="button"
        className="font-semibold text-brand underline"
        onClick={() => setConsent(consent === "granted" ? "denied" : "granted")}
      >
        {consent === "granted" ? "Turn off" : "Turn on"}
      </button>
    </p>
  );
}
