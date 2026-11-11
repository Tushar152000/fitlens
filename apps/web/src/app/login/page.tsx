import { redirect } from "next/navigation";
import Link from "next/link";
import { DevLogin } from "@/components/dev-login";
import { BareMark, LogoMark } from "@/components/logo";
import { GoogleMark } from "@/components/google-mark";
import { googleButton } from "@/components/onboarding/button-styles";
import { marketingFontVars } from "@/lib/fitr8-fonts";
import { currentUser } from "@/lib/server/api";
import { signInProviders } from "@/lib/server/providers";
import { HeroPlate } from "./hero-plate";
import { apiUrl } from "@/lib/api-url";

export const metadata = { title: "Log in — FITR8" };

/** Returning users. New users start at /welcome (the onboarding flow ends with sign-in). */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const [me, available, sp] = await Promise.all([currentUser(), signInProviders(), searchParams]);
  // Where to land after sign-in. Same-site paths only: no "//" or "/\", which browsers resolve to another host.
  const next = typeof sp.next === "string" && /^\/(?![/\\])/.test(sp.next) ? sp.next : "/home";
  if (me) redirect(next);
  // The API sends users back here with a short, user-facing reason (e.g. "Sign-in was cancelled").
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : null;

  return (
    <div
      className={`${marketingFontVars} min-h-dvh bg-fitr8-soft font-jakarta text-fitr8-ink antialiased lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]`}
    >
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-fitr8 p-12 text-white lg:flex">
        <BareMark className="pointer-events-none absolute -right-24 -bottom-20 w-[420px] opacity-[0.07]" />
        <Link href="/" className="flex items-center gap-2.5 self-start" aria-label="FITR8 home">
          <BareMark className="w-[26px]" />
          <span className="text-[22px] font-extrabold tracking-[-0.02em]">FITR8</span>
        </Link>
        <div className="relative">
          <h2 className="max-w-[12em] text-[48px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance">
            Snap your meal. Hit your goal.
          </h2>
          <p className="mt-4 max-w-[30em] text-lg text-white/80">
            Take a photo of your thali. We find the foods and portions, you confirm, and calories
            and macros are logged against targets built for your goal.
          </p>
        </div>
        <p className="relative text-sm text-white/70">
          General fitness guidance, not medical advice.
        </p>
      </aside>

      <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-6 py-10">
        <Link
          href="/"
          className="flex items-center gap-2 self-start lg:hidden"
          aria-label="FITR8 home"
        >
          <LogoMark size={30} />
          <span className="text-[19px] font-extrabold tracking-[-0.02em]">
            FIT<span className="text-fitr8">R8</span>
          </span>
        </Link>
        <HeroPlate className="my-8 lg:hidden" />

        <h1 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.025em]">
          Welcome back
        </h1>
        <p className="mt-2 text-ink-2">Log in to see today’s target, meals and workout.</p>

        <div className="mt-8 flex flex-col gap-3">
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
              href={apiUrl(`/api/auth/google?returnTo=${encodeURIComponent(next)}`)}
              className={googleButton}
            >
              <GoogleMark />
              Continue with Google
            </a>
          )}
          {available.dev && <DevLogin next={next} />}
          <p className="mt-3 text-center text-sm text-ink-2">
            New to FITR8?{" "}
            <Link href="/welcome" className="font-semibold text-fitr8 hover:underline">
              Build your free plan
            </Link>
          </p>
          <p className="text-center text-xs text-ink-3">
            By continuing you agree to our{" "}
            <Link href="/terms" className="font-semibold text-fitr8 hover:underline">
              Terms
            </Link>{" "}
            and{" "}
            <Link href="/privacy" className="font-semibold text-fitr8 hover:underline">
              Privacy Policy
            </Link>
            . FITR8 gives general fitness guidance and is not medical advice.
          </p>
        </div>
      </main>
    </div>
  );
}
