"use client";

import { useEffect, useRef, useState } from "react";
import { PlanBuilding } from "@/components/onboarding/plan-building";
import { track } from "@/lib/client/analytics";
import { api, ApiError } from "@/lib/client/api";
import { toPayload, validateStep } from "@/lib/onboarding/draft";
import { stashPending, takePending } from "@/lib/onboarding/pending";
import { PHONE_TAKEN } from "@fitr8/domain/person";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * After sign-in: save step 1 (name, last name, phone), then the onboarding answers (behind "Building your plan"), then
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
    /** Step 1. "taken" when another account has the number; other failures are ignored. */
    const saveName = (): Promise<"ok" | "taken"> =>
      pending?.name
        ? api("/api/profile/name", {
            method: "PATCH",
            json: {
              name: pending.name,
              ...(pending.lastName ? { lastName: pending.lastName } : {}),
              ...(pending.phone ? { phone: pending.phone } : {}),
            },
          }).then(
            () => "ok" as const,
            (e) => (e instanceof ApiError && e.status === 409 ? "taken" : "ok"),
          )
        : Promise.resolve("ok");

    const complete =
      pending && [1, 2, 3].every((s) => Object.keys(validateStep(s, pending.draft)).length === 0);
    if (onboarded) {
      void saveName().finally(() => window.location.replace("/home"));
      return;
    }

    void (async () => {
      // Before building anything: a taken number sends them back to step 1 with their answers.
      if ((await saveName()) === "taken" && pending) {
        stashPending({ ...pending, phoneError: PHONE_TAKEN });
        window.location.replace("/onboarding");
        return;
      }
      if (!complete) {
        window.location.replace("/onboarding");
        return;
      }
      setBuilding(true);
      try {
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
        await Promise.all([
          api("/api/onboarding", { method: "POST", json: toPayload(pending.draft, timezone) }),
          wait(2600),
        ]);
        track("onboarding_complete", { platform: "web" });
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
