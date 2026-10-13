import { redirect } from "next/navigation";
import { buttonClass } from "@/components/ui";
import { Logo } from "@/components/logo";
import { apiBaseUrl } from "@/lib/api-base";
import { currentUser } from "@/lib/server/api";
import type { ProvidersDto } from "@fitr8/contracts";
import { DevLogin } from "./dev-login";
import { HeroPlate } from "./hero-plate";

export const metadata = { title: "Sign in — FITR8" };

/** Which sign-in methods the API offers. If it can't be reached, still show Google. */
async function providers(): Promise<ProvidersDto> {
  try {
    const res = await fetch(`${apiBaseUrl()}/api/auth/providers`, { cache: "no-store" });
    if (res.ok) return (await res.json()) as ProvidersDto;
  } catch {
    // fall through
  }
  return { google: true, dev: false };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [me, available, sp] = await Promise.all([currentUser(), providers(), searchParams]);
  // Where to land after sign-in (e.g. the /welcome flow). Same-site paths only: no "//" or "/\", which browsers resolve to another host.
  const next = typeof sp.next === "string" && /^\/(?![/\\])/.test(sp.next) ? sp.next : "/today";
  if (me) redirect(next);
  // The API sends users back here with a short, user-facing reason (e.g. "Sign-in was cancelled").
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-[480px] flex-col px-6 pt-10 pb-8">
      <Logo size={30} />

      <HeroPlate className="my-8" />

      <h1 className="display text-[40px] leading-none">Snap your meal. Hit your goal.</h1>
      <p className="mt-3 text-ink-2">
        Take a photo of your thali. We find the foods and portions, you confirm, and calories and
        macros are logged against targets built for your goal.
      </p>

      <div className="mt-auto flex flex-col gap-3 pt-8">
        {error && (
          <p
            role="alert"
            className="rounded-input bg-caution-soft px-4 py-3 text-[13px] font-semibold text-caution-text"
          >
            {error}
          </p>
        )}

        {available.google && (
          <a
            href={`/api/auth/google?returnTo=${encodeURIComponent(next)}`}
            className={buttonClass("strong")}
          >
            <GoogleMark />
            Continue with Google
          </a>
        )}

        {available.dev && <DevLogin next={next} />}

        <p className="mt-2 text-center text-[12px] text-ink-3">
          By continuing you agree to our Terms and Privacy Policy. FITR8 gives general fitness
          guidance and is not medical advice.
        </p>
      </div>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}
