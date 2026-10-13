import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Fitr8Wordmark } from "@/components/fitr8-wordmark";
import { primaryPill } from "../pill";

export const metadata: Metadata = { title: "Welcome — FITR8" };

// Figma repeats one placeholder card three times; swap in the real slides when they're designed.
const SLIDES = [1, 2, 3].map((n) => ({
  key: n,
  image: "/welcome/salad-bowl.jpg",
  caption: ["Know what you're", "actually eating."],
}));

/** Figma "Onboarding 0" (3828:2321). */
export default function WelcomePage() {
  return (
    <main className="mx-auto flex max-w-[1440px] flex-col items-center px-6 pt-[90px] pb-16">
      <div className="flex flex-col items-center gap-[18px]">
        <p className="text-[20px] leading-[normal] font-bold text-black/55">Welcome to</p>
        <Fitr8Wordmark variant="welcome" size={33.566} />
      </div>

      <ul className="mt-[83px] flex w-full max-w-[1089px] flex-col items-center gap-10 md:flex-row md:items-start md:gap-[55px]">
        {SLIDES.map((s) => (
          <li key={s.key} className="flex w-full max-w-[328px] flex-col gap-[34px] md:flex-1">
            <div className="relative aspect-[391/414] w-full overflow-hidden rounded-[16px]">
              <Image
                src={s.image}
                alt="A bowl of salad with tofu, eggs, corn and greens"
                fill
                sizes="(min-width: 768px) 328px, 100vw"
                className="object-cover"
                priority={s.key === 1}
              />
            </div>
            <p className="text-center text-[20px] leading-[normal] font-medium text-fitr8-ink">
              {s.caption[0]}
              <br />
              {s.caption[1]}
            </p>
          </li>
        ))}
      </ul>

      <Link href="/welcome/name" className={`${primaryPill} mt-[73px] w-full max-w-[357px]`}>
        Continue
      </Link>
      <p className="mt-5 text-[15px] text-fitr8-ink/70">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-fitr8 underline-offset-4 hover:underline">
          Log in
        </Link>
      </p>
    </main>
  );
}
