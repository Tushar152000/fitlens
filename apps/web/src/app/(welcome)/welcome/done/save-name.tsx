"use client";

import { useEffect, useRef } from "react";
import { api } from "@/lib/client/api";
import { takeName } from "../pending-name";

export function SaveName({ onboarded }: { onboarded: boolean }) {
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // Strict Mode runs effects twice in dev.
    started.current = true;
    const name = takeName();
    const next = onboarded ? "/today" : "/onboarding";
    // A failed save isn't worth blocking sign-up over; the Google name stays in place.
    (name ? api("/api/profile/name", { method: "PATCH", json: { name } }) : Promise.resolve())
      .catch(() => undefined)
      .finally(() => window.location.replace(next));
  }, [onboarded]);

  return (
    <main className="flex min-h-dvh items-center justify-center">
      <p role="status" className="text-[16px] font-semibold text-fitr8-ink/55">
        Setting things up…
      </p>
    </main>
  );
}
