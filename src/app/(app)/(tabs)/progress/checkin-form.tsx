"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, NumberField } from "@/components/ui";
import { api } from "@/lib/client/api";

export function CheckinForm({
  lastWeightKg,
  lastWaistCm,
}: {
  lastWeightKg: number | null;
  lastWaistCm: number | null;
}) {
  const router = useRouter();
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [errors, setErrors] = useState<{ weight?: string; waist?: string }>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const w = Number(weight);
    const wc = waist.trim() ? Number(waist) : undefined;
    const next: typeof errors = {};
    if (!weight.trim() || !Number.isFinite(w) || w < 30 || w > 250)
      next.weight = "Enter weight between 30 and 250";
    if (wc !== undefined && (!Number.isFinite(wc) || wc < 40 || wc > 200))
      next.waist = "Enter waist between 40 and 200";
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("saving");
    setServerError(null);
    try {
      await api("/api/checkins", { method: "POST", json: { weightKg: w, waistCm: wc } });
      setStatus("saved");
      setWeight("");
      setWaist("");
      router.refresh();
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setStatus("idle");
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 rounded-card bg-surface p-4" noValidate>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          label="Weight"
          unit="kg"
          placeholder={lastWeightKg != null ? String(lastWeightKg) : "75"}
          value={weight}
          onValueChange={(v) => {
            setWeight(v);
            setStatus("idle");
          }}
          error={errors.weight}
        />
        <NumberField
          label="Waist (optional)"
          unit="cm"
          placeholder={lastWaistCm != null ? String(lastWaistCm) : "85"}
          value={waist}
          onValueChange={(v) => {
            setWaist(v);
            setStatus("idle");
          }}
          error={errors.waist}
        />
      </div>
      <p className="text-[13px] text-ink-3">Weigh in the morning, after the loo, before food.</p>
      {serverError && (
        <p role="alert" className="text-[13px] font-semibold text-brand">
          {serverError}
        </p>
      )}
      <Button type="submit" variant="strong" disabled={status === "saving"}>
        {status === "saving" ? "Saving…" : status === "saved" ? "Saved — thanks" : "Save check-in"}
      </Button>
    </form>
  );
}
