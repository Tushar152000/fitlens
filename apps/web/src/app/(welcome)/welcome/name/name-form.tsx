"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { PreferredNameSchema, type MeDto } from "@fitr8/contracts";
import { api, ApiError } from "@/lib/client/api";
import { primaryPill } from "../../pill";
import { stashName } from "../pending-name";

/** Where the flow continues once the name is saved. Steps 2–5 aren't designed yet. */
const afterName = (onboarded: boolean) => (onboarded ? "/today" : "/onboarding");

export function NameForm({
  initialName,
  signedIn,
  onboarded,
}: {
  initialName: string;
  signedIn: boolean;
  onboarded: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const parsed = PreferredNameSchema.safeParse({ name });
    if (!parsed.success) {
      setError(
        name.trim() ? "Keep it under 60 characters." : "Tell us the name you’d like us to use.",
      );
      return;
    }
    setError(null);
    setBusy(true);

    if (!signedIn) {
      // Sign in first; /welcome/done saves the name and carries on.
      stashName(parsed.data.name);
      router.push(`/login?next=${encodeURIComponent("/welcome/done")}`);
      return;
    }
    try {
      await api<MeDto>("/api/profile/name", { method: "PATCH", json: parsed.data });
      router.push(afterName(onboarded));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't save your name. Try again.");
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      className="mt-[26px] flex flex-col sm:min-h-[512px] sm:px-[8.5px]"
    >
      <div className="flex flex-col gap-[38px]">
        <div className="flex flex-col gap-[6px] leading-[normal]">
          <h1 className="text-[22px] font-bold text-fitr8-ink">First, what can we call you?</h1>
          <p className="text-[18px] font-semibold text-fitr8-ink/55">
            We’d like to get to know you.
          </p>
        </div>

        <div className="flex flex-col gap-[6px]">
          <label
            htmlFor="preferred-name"
            className="text-[16px] leading-[normal] font-semibold text-fitr8-ink/44"
          >
            Preferred first name
          </label>
          <input
            id="preferred-name"
            name="name"
            autoFocus
            autoComplete="given-name"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "preferred-name-error" : undefined}
            suppressHydrationWarning
            className="h-[59px] w-full rounded-[8px] border-2 border-fitr8 px-4 text-[18px] text-fitr8-ink caret-fitr8 outline-none"
          />
          {error && (
            <p
              id="preferred-name-error"
              role="alert"
              className="text-[14px] font-medium text-red-700"
            >
              {error}
            </p>
          )}
        </div>
      </div>

      <div className="mt-12 flex items-center gap-[13px] sm:mt-auto">
        <Link
          href="/welcome"
          aria-label="Back"
          className="flex size-12 shrink-0 items-center justify-center rounded-full bg-fitr8/10"
        >
          <Image
            src="/welcome/icon-back.svg"
            alt=""
            width={24}
            height={24}
            className="-rotate-90"
          />
        </Link>
        <button type="submit" disabled={busy} className={`${primaryPill} flex-1`}>
          {busy ? "Saving…" : "Next"}
        </button>
      </div>
    </form>
  );
}
