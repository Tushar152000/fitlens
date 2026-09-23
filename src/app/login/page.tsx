import { redirect } from "next/navigation";
import { auth, signIn } from "@/auth";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <h1 className="text-2xl font-semibold">Sign in to FitLens</h1>
      <form
        action={async () => {
          "use server";
          await signIn("google", { redirectTo: "/dashboard" });
        }}
      >
        <button className="w-full rounded-lg border border-neutral-300 px-4 py-3 font-medium hover:bg-neutral-50 dark:hover:bg-neutral-900">
          Continue with Google
        </button>
      </form>
      {process.env.AUTH_RESEND_KEY && (
        <form
          className="flex flex-col gap-3"
          action={async (formData) => {
            "use server";
            await signIn("resend", { email: formData.get("email"), redirectTo: "/dashboard" });
          }}
        >
          <input
            name="email"
            type="email"
            required
            placeholder="you@example.com"
            className="rounded-lg border border-neutral-300 px-4 py-3"
          />
          <button className="rounded-lg bg-emerald-600 px-4 py-3 font-medium text-white">
            Email me a link
          </button>
        </form>
      )}
    </main>
  );
}
