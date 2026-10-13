"use client";

import { ChevronDown, Copy } from "lucide-react";
import { useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

export const CONTACT_EMAIL = "ask@fitr8.com";

// Only the first answer is written in Figma; the rest describe what the app does today and need
// product sign-off ("Is FITR8 free?" follows the free tier in docs/DESIGN.md).
const FAQS = [
  {
    q: "What is FITR8?",
    a: "FITR8 is your all-in-one fitness companion that brings nutrition tracking, workout logging, and progress tracking together to help you stay consistent and work towards your fitness goals.",
  },
  {
    q: "How does FITR8 track my food?",
    a: "Snap a photo of your plate, type or say what you ate, scan a packaged food’s barcode, or photograph its nutrition label. FITR8 finds the foods and portions, you confirm them, and the calories and macros are logged against your daily targets.",
  },
  {
    q: "Can FITR8 help me improve my workouts?",
    a: "Yes. FITR8 builds a weekly plan from your goal, experience and equipment, and uses your nutrition and training history to set a target for your next session.",
  },
  {
    q: "Is FITR8 suitable for beginners?",
    a: "Yes. You tell FITR8 your experience level when you set up, and your plan starts from there. It gives general fitness guidance, not medical advice.",
  },
  {
    q: "Is FITR8 free?",
    a: "You can start for free. Typing meals and relogging your usual meals are always free, and the free plan includes a few photo scans every day.",
  },
];

/** Sticky title + "Still have questions?" card beside a one-open-at-a-time accordion. */
export function Faq() {
  const [open, setOpen] = useState(0);
  const base = useId();

  return (
    <section id="faq" className="scroll-mt-16 py-16 sm:py-28">
      <div className="mx-auto grid max-w-[1300px] items-start gap-8 px-4 sm:px-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:gap-16 lg:px-10">
        <div className="flex flex-col gap-8 lg:sticky lg:top-[100px]">
          <div>
            <p className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-fitr8 uppercase">
              FAQ
            </p>
            <h2 className="text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[48px]">
              Frequently asked questions
            </h2>
          </div>
          <AskCard />
        </div>

        <div className="flex flex-col gap-3">
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div
                key={f.q}
                className={cn(
                  "rounded-[20px] bg-white transition-shadow duration-200",
                  isOpen && "shadow-[inset_0_0_0_2px_var(--color-fitr8)]",
                )}
              >
                <h3>
                  <button
                    type="button"
                    id={`${base}-q${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`${base}-a${i}`}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                    className={cn(
                      "flex w-full items-center justify-between gap-4 px-6 py-[22px] text-left text-[19px] font-semibold tracking-[-0.01em]",
                      isOpen && "text-fitr8",
                    )}
                  >
                    {f.q}
                    <span
                      className={cn(
                        "grid size-[34px] shrink-0 place-items-center rounded-full transition-[transform,background-color] duration-200",
                        isOpen ? "rotate-180 bg-fitr8-lilac-soft" : "bg-fitr8-soft",
                      )}
                    >
                      <ChevronDown className="size-[18px]" aria-hidden />
                    </span>
                  </button>
                </h3>
                <div
                  id={`${base}-a${i}`}
                  role="region"
                  aria-labelledby={`${base}-q${i}`}
                  className={cn(
                    "grid transition-[grid-template-rows] duration-300 ease-out",
                    isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                  )}
                >
                  <div className="overflow-hidden">
                    <p className="max-w-[38em] px-6 pb-6 text-ink-2">{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function AskCard() {
  const [label, setLabel] = useState("Copy");
  const addr = useRef<HTMLAnchorElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
      setLabel("Copied");
    } catch {
      // No clipboard access: select the address so the user can copy it themselves.
      const range = document.createRange();
      if (addr.current) range.selectNodeContents(addr.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      setLabel("Selected");
    }
    window.setTimeout(() => setLabel("Copy"), 1600);
  }

  return (
    <div className="flex flex-col gap-3 rounded-[20px] bg-white p-6">
      <h3 className="text-[22px] font-semibold tracking-[-0.02em]">Still have questions?</h3>
      <p className="text-[15px] text-ink-2">
        Can’t find the answer you need? Email us and we’ll get back to you as soon as we can.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <a
          ref={addr}
          href={`mailto:${CONTACT_EMAIL}`}
          className="rounded-[10px] bg-fitr8-soft px-3 py-2 font-semibold select-all hover:underline"
        >
          {CONTACT_EMAIL}
        </a>
        <button
          type="button"
          onClick={copy}
          className="inline-flex h-[38px] items-center gap-1.5 rounded-full bg-fitr8 px-3.5 text-sm font-semibold text-white hover:bg-brand-hover"
        >
          <Copy className="size-4" aria-hidden />
          <span aria-live="polite">{label}</span>
        </button>
      </div>
    </div>
  );
}
