import type { Metadata } from "next";
import Image from "next/image";
import { Fitr8Wordmark } from "@/components/fitr8-wordmark";
import { currentUser } from "@/lib/server/api";
import { WelcomeProgress } from "../progress";
import { NameForm } from "./name-form";

export const metadata: Metadata = { title: "What can we call you? — FITR8" };

/** Figma "Onboarding 1" (3828:3096): step 1 of 5. Works signed in or out. */
export default async function NamePage() {
  const me = await currentUser();

  return (
    <main className="relative flex min-h-dvh flex-col items-center px-4 pt-[65px] pb-10">
      {/* 5% purple backdrop shape, 1018 × 961 starting 40 px left of the frame. */}
      <Image
        aria-hidden
        src="/welcome/backdrop.svg"
        alt=""
        width={1018}
        height={961}
        className="pointer-events-none absolute top-0 left-[-40.23px] hidden h-[961px] w-[1018.45px] max-w-none md:block"
        priority
      />

      <Fitr8Wordmark variant="ink" size={33.566} className="relative" />

      <section className="relative mt-[58px] w-full max-w-[458px] rounded-[16px] bg-white px-6 py-[30px] drop-shadow-[0_20px_10px_rgba(0,0,0,0.08)] sm:px-[42px]">
        <div className="flex flex-col items-center gap-6">
          <p className="text-[16px] leading-[normal] font-bold text-black/55">Welcome</p>
          <WelcomeProgress step={1} />
        </div>
        <NameForm
          initialName={me?.name ?? ""}
          signedIn={me !== null}
          onboarded={me?.onboarded ?? false}
        />
      </section>
    </main>
  );
}
