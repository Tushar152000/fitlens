"use client";

import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui";
import { signOutOfAdmin } from "./sign-out";

/** Signed in, but not FITR8 staff. */
export function NoAccess({ reason, email }: { reason: string; email: string | null }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-6 py-10">
      <div className="grid size-14 place-items-center rounded-card bg-sunken text-ink-2">
        <ShieldOff className="size-7" aria-hidden />
      </div>
      <h1 className="mt-6 display text-[28px] leading-tight">No access to FITR8 admin</h1>
      <p className="mt-2 text-ink-2">{reason}</p>
      {email && (
        <p className="mt-4 text-[14px] text-ink-3">
          Signed in as <span className="font-semibold text-ink-2">{email}</span>
        </p>
      )}
      <div className="mt-8">
        <Button variant="secondary" onClick={signOutOfAdmin}>
          Use another Google account
        </Button>
      </div>
    </main>
  );
}
