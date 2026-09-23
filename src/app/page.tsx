import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-bold tracking-tight">FitLens</h1>
      <p className="text-lg text-neutral-600 dark:text-neutral-300">
        Snap a photo of your meal. Get calories and macros in seconds. Follow a workout plan that
        adapts to your progress every week.
      </p>
      <div>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-emerald-600 px-5 py-3 font-medium text-white hover:bg-emerald-700"
        >
          Get started
        </Link>
      </div>
    </main>
  );
}
