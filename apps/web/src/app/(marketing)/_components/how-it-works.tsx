import { Check } from "lucide-react";
import { SectionHead } from "./section-head";

/** Three real steps, so numbered. Each card previews the matching piece of the app. */
export function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-16 py-16 sm:py-28">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
        <SectionHead
          kicker="How it works"
          title="From sign-up to your next move in three steps"
          aside="FITR8 checks your goal is safe, keeps logging quick, and adjusts your plan from your real results."
        />
        <ol className="grid gap-5 md:grid-cols-3">
          <Step
            n={1}
            title="Set your goal"
            body="Tell us your goal, your body stats and how you like to train. FITR8 checks the pace is safe before it builds your plan."
          >
            <div className="flex items-center justify-between gap-2.5">
              <span className="font-semibold">Lose fat · 74 kg</span>
              <Badge tone="ok">
                <Check className="size-3.5" strokeWidth={2.6} aria-hidden />
                Realistic goal
              </Badge>
            </div>
            <span className="text-xs font-semibold text-ink-3">
              By 1 Mar 2027 · about 0.4 kg a week
            </span>
          </Step>
          <Step
            n={2}
            title="Log in seconds"
            body="Snap, say, type or scan. Confirm the portions, and any item FITR8 is unsure about gets flagged for you to check."
          >
            <div className="flex items-center justify-between gap-2.5">
              <span>
                <span className="block text-xs font-semibold text-ink-3">Lunch · 13:15</span>
                <span className="font-semibold">2 roti, dal, bhindi, curd</span>
              </span>
              <span className="font-semibold tabular-nums">575 kcal</span>
            </div>
            <span>
              <Badge tone="warn">Not sure: bhindi portion</Badge>
            </span>
          </Step>
          <Step
            n={3}
            title="Get your next move"
            body="Each week your targets adjust from your real trend, and every workout sets the target for the next one."
          >
            <div className="flex items-start gap-2.5 rounded-xl bg-protein-soft px-3 py-2.5">
              <span className="grid size-[22px] shrink-0 place-items-center rounded-full bg-protein text-white">
                <Check className="size-3.5" strokeWidth={3} aria-hidden />
              </span>
              <span>
                <span className="block font-semibold">On track. Targets stay at 1,836 kcal</span>
                <span className="text-xs font-semibold text-ink-3">
                  −0.4 kg this week vs −0.4 kg planned
                </span>
              </span>
            </div>
          </Step>
        </ol>
      </div>
    </section>
  );
}

function Step({
  n,
  title,
  body,
  children,
}: {
  n: number;
  title: string;
  body: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex flex-col gap-3.5 rounded-[20px] bg-white p-[26px] transition-[transform,box-shadow] duration-200 hover:-translate-[3px] hover:shadow-hard">
      <span className="grid size-10 place-items-center rounded-xl bg-fitr8-ink text-[19px] font-semibold text-white">
        {n}
      </span>
      <h3 className="text-2xl font-semibold tracking-[-0.02em]">{title}</h3>
      <p className="text-ink-2">{body}</p>
      <div className="mt-auto flex flex-col gap-2 rounded-2xl bg-fitr8-soft p-3.5 text-sm">
        {children}
      </div>
    </li>
  );
}

function Badge({ tone, children }: { tone: "ok" | "warn"; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        tone === "ok" ? "bg-protein-soft text-protein" : "bg-caution-soft text-caution-text"
      }`}
    >
      {children}
    </span>
  );
}
