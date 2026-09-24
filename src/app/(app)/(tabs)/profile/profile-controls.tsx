"use client";

import { Crown, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button, Switch } from "@/components/ui";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/cn";

/** Design 13 reminder switches, saved as you toggle. */
export function Reminders({ lunch, dinner }: { lunch: boolean; dinner: boolean }) {
  const [state, setState] = useState({ lunch, dinner });
  const [error, setError] = useState<string | null>(null);

  async function toggle(key: "lunch" | "dinner", value: boolean) {
    setState((s) => ({ ...s, [key]: value }));
    setError(null);
    try {
      await api("/api/profile/reminders", { method: "PATCH", json: { [key]: value } });
    } catch {
      setState((s) => ({ ...s, [key]: !value }));
      setError("Couldn't save. Try again.");
    }
  }

  return (
    <>
      {(
        [
          ["lunch", "Lunch reminder", "2 pm, if lunch isn't logged"],
          ["dinner", "Dinner reminder", "9 pm, if dinner isn't logged"],
        ] as const
      ).map(([key, label, sub]) => (
        <div key={key} className="flex min-h-14 items-center justify-between gap-4 px-4 py-2.5">
          <span className="flex flex-col">
            <span id={`remind-${key}`} className="font-semibold">
              {label}
            </span>
            <span className="text-[13px] text-ink-3">{sub}</span>
          </span>
          <Switch
            checked={state[key]}
            onChange={(v) => toggle(key, v)}
            labelledBy={`remind-${key}`}
          />
        </div>
      ))}
      {error && (
        <p role="alert" className="px-4 py-2 text-[13px] font-semibold text-brand">
          {error}
        </p>
      )}
    </>
  );
}

/** Plan card: free scans left today + Go Pro. */
export function PlanCard({ usage }: { usage: { used: number; limit: number; left: number } }) {
  const [note, setNote] = useState(false);
  const pips = Math.min(usage.limit, 10);
  const usedPips = Math.min(pips, Math.round((usage.used / usage.limit) * pips));
  return (
    <section className="flex flex-col gap-3 rounded-card bg-surface p-4" aria-label="Your plan">
      <div className="flex items-center justify-between">
        <p className="font-semibold">Free plan</p>
        <p className="text-[13px] font-semibold text-ink-3 tabular-nums">
          {usage.left} of {usage.limit} photo scans left today
        </p>
      </div>
      <div className="flex gap-1.5" aria-hidden>
        {Array.from({ length: pips }, (_, i) => (
          <span
            key={i}
            className={cn("h-2 flex-1 rounded-full", i < usedPips ? "bg-brand" : "bg-track")}
          />
        ))}
      </div>
      <p className="text-[13px] text-ink-3">Typing meals and relogging usuals are always free.</p>
      <Button variant="strong" onClick={() => setNote(true)}>
        <Crown className="size-5 text-brand-glow" aria-hidden />
        Go Pro
      </Button>
      {note && (
        <p role="status" className="text-center text-[13px] text-ink-3">
          Pro isn&apos;t available yet.
        </p>
      )}
    </section>
  );
}

/** Delete account (danger text), with a typed confirmation. */
export function DangerZone() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    const answer = window.prompt(
      "This deletes your account, meals, weigh-ins and plan for good. Type DELETE to confirm.",
    );
    if (answer?.trim().toUpperCase() !== "DELETE") return;
    setBusy(true);
    setError(null);
    try {
      await api("/api/account", { method: "DELETE" });
      window.location.assign(new URL("/login", window.location.origin).href);
    } catch {
      setError("Couldn't delete your account. Try again.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="flex min-h-11 items-center gap-1.5 px-3 text-[15px] font-semibold text-brand hover:text-brand-hover"
      >
        <Trash2 className="size-4" aria-hidden />
        {busy ? "Deleting…" : "Delete account"}
      </button>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-brand">
          {error}
        </p>
      )}
    </div>
  );
}
