"use client";

import { useEffect, useRef, useState } from "react";
import { PlanBuilding } from "@/components/onboarding/plan-building";
import { api, ApiError } from "@/lib/client/api";
import { toPayload, validateStep } from "@/lib/onboarding/draft";
import { stashPending, takePending } from "@/lib/onboarding/pending";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * After sign-in: save the name, then the onboarding answers (behind "Building your plan"), then
 * the plan. Already onboarded → /home, answers dropped. No answers (other tab, storage blocked) →
 * the signed-in form. If saving fails, the answers go back into storage for /onboarding to reuse.
 */
export function FinishSignup({ onboarded }: { onboarded: boolean }) {
  const started = useRef(false);
  const [building, setBuilding] = useState(false);
  const [built, setBuilt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) return; // Strict Mode runs effects twice in dev.
    started.current = true;
    const pending = takePending();
    const saveName = () =>
      pending?.name
        ? api("/api/profile/name", { method: "PATCH", json: { name: pending.name } }).catch(
            () => undefined,
          )
        : Promise.resolve();

    const complete =
      pending && [1, 2, 3].every((s) => Object.keys(validateStep(s, pending.draft)).length === 0);
    if (onboarded || !complete) {
      void saveName().finally(() => window.location.replace(onboarded ? "/home" : "/onboarding"));
      return;
    }

    void (async () => {
      setBuilding(true);
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
        await Promise.all([
          saveName(),
          api("/api/onboarding", { method: "POST", json: toPayload(pending.draft, timezone) }),
          wait(2600),
        ]);
        setBuilt(true);
        await wait(700);
        window.location.replace("/onboarding/plan?flow=welcome");
      } catch (e) {
        stashPending(pending);
        const details =
          e instanceof ApiError ? (e.details as { message?: string }[] | undefined) : undefined;
        setError(
          details?.[0]?.message ?? (e instanceof Error ? e.message : "Something went wrong."),
        );
        setBuilding(false);
      }
    })();
  }, [onboarded]);

  if (error) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="text-2xl font-semibold tracking-[-0.02em]">We couldn’t save your plan</h1>
        <p className="text-ink-2">{error}</p>
        <a
          href="/onboarding"
          className="inline-flex h-[54px] items-center rounded-full bg-fitr8 px-6 font-semibold text-white shadow-hard"
        >
          Check my answers
        </a>
      </main>
    );
  }
  return building ? (
    <PlanBuilding done={built} />
  ) : (
    <main className="flex min-h-dvh items-center justify-center">
      <p role="status" className="font-semibold text-ink-3">
        Setting things up…
      </p>
    </main>
  );
}
