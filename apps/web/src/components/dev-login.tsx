"use client";

import { LogIn } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";
import { api, ApiError } from "@/lib/client/api";

/** Local development only (the API offers it when AUTH_DEV_LOGIN is on): sign in by email, no Google. */
export function DevLogin({ next }: { next: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/dev", { method: "POST", json: { email: email.trim() } });
      // A full load so the server render sees the new session cookie.
      window.location.assign(new URL(next, window.location.origin).href);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't sign in. Try again.");
      setBusy(false);
    }
  }

  return (
    <form className="flex flex-col gap-3" onSubmit={submit}>
      <label htmlFor="dev-email" className="text-[13px] font-semibold text-ink-2">
        Developer sign-in
      </label>
      <input
        id="dev-email"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-[54px] rounded-input border border-line-strong bg-surface px-4 text-base outline-none focus:border-ink"
      />
      <Button type="submit" variant="secondary" disabled={busy}>
        <LogIn className="size-5" aria-hidden />
        {busy ? "Signing in…" : "Sign in with email (dev)"}
      </Button>
      {error && (
        <p role="alert" className="text-[13px] font-semibold text-ink">
          {error}
        </p>
      )}
    </form>
  );
}
