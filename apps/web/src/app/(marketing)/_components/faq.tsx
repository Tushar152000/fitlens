import Image from "next/image";

export const CONTACT_EMAIL = "ask@fitr8.com";

// Only the first answer is written in Figma; the other three describe what the app does today
// and need product sign-off.
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
];

/** Figma 3823:2176: title + "Still have questions" card on the left, accordion on the right. */
export function Faq() {
  return (
    <section className="flex justify-center px-4 pt-[62px] pb-[62px]">
      {/* Figma places this 898 px block at x 245, i.e. 26 px left of centre. */}
      <div className="flex w-full max-w-[898px] flex-col gap-10 md:flex-row md:items-center md:gap-[38px] lg:mr-[52px]">
        <div className="flex w-full flex-col gap-10 md:w-[341px] md:shrink-0 md:gap-[165px]">
          <h2 className="text-[30px] leading-[1.1] font-semibold sm:text-[38px]">
            Frequently asked
            <br />
            questions
          </h2>
          <div className="order-last rounded-[16px] bg-fitr8-soft p-6 md:order-none">
            <p className="text-[20px] leading-[1.35] font-semibold text-fitr8-ink">
              Still have a questions?
            </p>
            <p className="mt-3 max-w-[292px] text-[12px] leading-[1.41] font-medium text-fitr8-ink/55">
              Can’t find the answer to your question? Send us an email and we’ll get back to you as
              soon as possible
            </p>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="mt-5 flex h-[39px] w-[132px] items-center justify-center rounded-full bg-fitr8 font-roboto text-[14px] leading-5 font-bold tracking-[0.1px] text-white"
            >
              Send email
            </a>
          </div>
        </div>

        <div className="flex w-full flex-col gap-[14px] md:w-[519px]">
          {FAQS.map((f, i) => (
            <details
              key={f.q}
              name="faq"
              open={i === 0}
              className="group rounded-[16px] bg-fitr8-soft px-6 py-6 open:pb-[34px]"
            >
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                <span className="text-[20px] leading-[1.35] font-semibold text-fitr8-ink group-open:text-fitr8">
                  {f.q}
                </span>
                <Image
                  src="/landing/icon-faq-chevron.svg"
                  alt=""
                  width={28}
                  height={26}
                  className="shrink-0 group-open:-scale-y-100"
                />
              </summary>
              <p className="mt-[14px] max-w-[442px] text-[14px] leading-[1.41] font-medium text-fitr8-ink/55">
                {f.a}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
