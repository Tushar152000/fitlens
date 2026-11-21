import { PenLine } from "lucide-react";
import { redirect } from "next/navigation";
import { DevLogin } from "@/components/dev-login";
import { GoogleMark } from "@/components/google-mark";
import { LogoMark } from "@/components/logo";
import { buttonClass } from "@/components/ui";
import { apiUrl } from "@/lib/api-url";
import { currentUser } from "@/lib/server/api";
import { signInProviders } from "@/lib/server/providers";

export const metadata = { title: "Sign in" };

/** Admin sign-in (every section): the team's normal Google accounts. Access itself is decided by the API. */
export default async function AdminLogin({ searchParams }: PageProps<"/admin/login">) {
  const [me, providers, sp] = await Promise.all([currentUser(), signInProviders(), searchParams]);
  if (me) redirect("/admin");
  const error = typeof sp.error === "string" ? sp.error.slice(0, 200) : null;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col justify-center px-6 py-10">
      <div className="flex items-center gap-2.5">
        <LogoMark size={36} />
        <span className="font-display text-[22px] font-bold tracking-[-0.02em]">
          FIT<span className="text-brand">R8</span> <span className="text-ink-3">Admin</span>
        </span>
      </div>
      <h1 className="mt-10 display text-[30px] leading-tight">Sign in to FITR8 admin</h1>
      <p className="mt-2 text-ink-2">
        Use the Google account your admin invited. One sign-in for every section: the blog and what
        comes next.
      </p>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-input bg-caution-soft px-4 py-3 text-[14px] font-semibold text-caution-text"
        >
          {error}
        </p>
      )}
      <div className="mt-8 flex flex-col gap-4">
        {providers.google && (
          <a href={apiUrl("/api/auth/google?returnTo=/admin")} className={buttonClass("secondary")}>
            <GoogleMark />
            Continue with Google
          </a>
        )}
        {providers.dev && <DevLogin next="/admin" />}
      </div>
      <p className="mt-10 flex items-center gap-2 text-[13px] text-ink-3">
        <PenLine className="size-4" aria-hidden />
        Not on the team? Ask a FITR8 admin to invite your email.
      </p>
    </main>
  );
}
