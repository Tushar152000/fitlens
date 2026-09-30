"use client";

import { WifiOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { flushQueue } from "@/lib/client/offline-queue";

function subscribe(onChange: () => void) {
  window.addEventListener("online", onChange);
  window.addEventListener("offline", onChange);
  return () => {
    window.removeEventListener("online", onChange);
    window.removeEventListener("offline", onChange);
  };
}

export function useOnline() {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}

/** Offline banner; when the connection returns, sends typed meals queued while offline. */
export function OfflineBanner() {
  const online = useOnline();
  const router = useRouter();

  useEffect(() => {
    if (!online) return;
    flushQueue().then((sent) => sent > 0 && router.refresh());
  }, [online, router]);

  if (online) return null;
  return (
    <div
      role="status"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 bg-ink px-4 py-2.5 text-[13px] font-semibold text-white"
    >
      <WifiOff className="size-4" aria-hidden />
      You&apos;re offline — we&apos;ll sync when you&apos;re back
    </div>
  );
}
