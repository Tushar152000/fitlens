import Image from "next/image";

const STATS = [
  { value: "100+", label: "Exercises", width: "w-[122px]" },
  { value: "50+", label: "Nutrients tracked", width: "w-[162px]" },
  { value: "7DAYS", label: "Of progress", width: "w-[144px]" },
];

/** Figma 3808:1953: 703 px purple band; app screenshots start at y 432 and run off the bottom. */
export function Stats() {
  return (
    <section className="relative overflow-hidden bg-fitr8 px-4 pt-[58px] lg:h-[703px]">
      <div className="mx-auto flex max-w-[1026px] flex-col items-center gap-12">
        <div className="flex max-w-[680px] flex-col items-center gap-[22px] text-center">
          <h2 className="text-[30px] leading-[1.1] font-semibold text-white sm:text-[38px]">
            From your first meal to your last rep,
            <br />
            and{" "}
            <span className="inline-block rounded-[8px] bg-white px-[10px] py-1 text-fitr8">
              everything in between.
            </span>
          </h2>
          <p className="text-[14px] leading-[1.55] font-medium text-white/80">
            Whether you’re cooking at home, eating out, working out at home, or hitting the gym,
            <br className="hidden sm:inline" /> FITR8 helps you track it all without breaking your
            routine.
          </p>
        </div>

        <dl className="flex flex-wrap items-center justify-center gap-x-[42px] gap-y-4 rounded-[32px] border border-white px-8 py-4 text-center sm:rounded-[400px]">
          {STATS.map((s) => (
            <div key={s.label} className={`flex flex-col-reverse items-center gap-1 ${s.width}`}>
              <dt className="text-[14px] leading-[1.55] font-semibold text-white/80 uppercase">
                {s.label}
              </dt>
              <dd className="text-[38px] leading-[1.1] font-extrabold text-white">{s.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      <Image
        src="/landing/app-screens.png"
        alt="FITR8 app screens: Today, meal log, food detail, plan and progress"
        width={936}
        height={304}
        className="mx-auto mt-10 h-auto w-full max-w-[936px] object-cover lg:absolute lg:top-[432px] lg:left-[calc(50%-11.5px)] lg:mt-0 lg:h-[304px] lg:w-[936px] lg:-translate-x-1/2"
      />
    </section>
  );
}
