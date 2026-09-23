"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet } from "@/components/sheet";
import { Button } from "@/components/ui";
import { api } from "@/lib/client/api";
import type { MealType } from "@/lib/format";

/** Shown on 429 from POST /api/meals. "Type it instead" makes an empty meal with no AI call. */
export function AiLimitSheet({
  open,
  onClose,
  mealType,
}: {
  open: boolean;
  onClose: () => void;
  mealType: MealType;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proNote, setProNote] = useState(false);

  async function typeInstead() {
    setBusy(true);
    setError(null);
    try {
      const log = await api<{ id: string }>("/api/meals", {
        method: "POST",
        json: { source: "MANUAL", mealType },
      });
      router.push(`/log/${log.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="You've used today's free scans">
      <p className="text-ink-2">
        The free plan includes a set number of AI scans a day. You can still log this meal by
        picking foods yourself — it takes about a minute. Scans reset tomorrow.
      </p>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-brand">
          {error}
        </p>
      )}
      <Button onClick={typeInstead} disabled={busy}>
        {busy ? "Opening…" : "Type it instead"}
      </Button>
      <Button variant="secondary" onClick={() => setProNote(true)}>
        Go Pro
      </Button>
      {proNote && (
        <p role="status" className="text-center text-[13px] text-ink-3">
          Pro with unlimited scans is coming soon.
        </p>
      )}
    </Sheet>
  );
}
