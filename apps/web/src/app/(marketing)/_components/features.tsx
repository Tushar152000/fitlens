import Image from "next/image";
import { RotatingWord } from "./rotating-word";

/**
 * Figma 3806:1777: dark band, 80 px padding, 52 px semibold, a word on a purple pill. The pill
 * cycles Nutrition → Workout → Progress every second.
 */
export function TrackBand() {
  return (
    <section className="relative bg-fitr8-night px-[10px] py-20 text-center text-[36px] leading-[1.1] font-semibold text-white sm:text-[52px]">
      <h2>
        <span className="flex items-start justify-center gap-5">
          Track
          <RotatingWord words={["Nutrition", "Workout", "Progress"]} />
        </span>
        <span className="block">at one place</span>
      </h2>
    </section>
  );
}

type Feature = {
  icon: string;
  title: [string, string?];
  body: string;
  /** Mockup inside the 325 × 260 tile. The last three are app screens framed like Figma’s snap mockup. */
  mockup?: { src: string; className: string; width: number; height: number };
  imageFirst: boolean;
  /** Only the voice tile has 8 px corners in Figma. */
  tileRounded?: boolean;
  /** The progress icon is drawn mirrored in the design. */
  iconClassName?: string;
};

const FEATURES: Feature[] = [
  {
    icon: "/landing/icon-snap.svg",
    title: ["Snap it.", "FITR8 logs it."],
    body: "Take a photo of your meal and let FITR8 identify what’s on your plate and log the nutrition for you.",
    mockup: {
      src: "/landing/feature-snap.png",
      width: 395,
      height: 387,
      className: "top-[-5px] left-0 h-[387px] w-[395px]",
    },
    imageFirst: true,
  },
  {
    icon: "/landing/icon-voice.svg",
    title: ["Just say what you ate."],
    body: "Tell FITR8 what you had and let your voice do the logging. No searching, typing, or complicated entries.",
    mockup: {
      src: "/landing/feature-voice.png",
      width: 340,
      height: 292,
      className: "top-[-9px] left-[-15px] h-[292px] w-[340px]",
    },
    imageFirst: false,
    tileRounded: true,
  },
  {
    icon: "/landing/icon-scan.svg",
    title: ["Skip the search", "with a scan"],
    body: "Scan any packaged food to instantly see its calories and macros and add it to your daily log.",
    mockup: {
      src: "/landing/feature-scan.png",
      width: 650,
      height: 520,
      className: "top-0 left-0 h-[260px] w-[325px]",
    },
    imageFirst: true,
  },
  {
    icon: "/landing/icon-lift.svg",
    title: ["Know what", "to lift next."],
    body: "FITR8 learns from your nutrition and training history to set a personalized target for your next workout.",
    mockup: {
      src: "/landing/feature-lift.png",
      width: 650,
      height: 520,
      className: "top-0 left-0 h-[260px] w-[325px]",
    },
    imageFirst: false,
  },
  {
    icon: "/landing/icon-progress.svg",
    title: ["Watch your progress add up."],
    body: "Track your changes over time, from strength gains to body composition, and see how your consistency translates into results.",
    mockup: {
      src: "/landing/feature-progress.png",
      width: 650,
      height: 520,
      className: "top-0 left-0 h-[260px] w-[325px]",
    },
    imageFirst: true,
    iconClassName: "-scale-x-100",
  },
];

/** Figma 3806:1779 heading + 3808:1808: five 877 px cards, 20 px apart, alternating sides. */
export function Features() {
  return (
    <section id="features" className="scroll-mt-16 px-6 pt-[58px] pb-[84px] lg:px-[120px]">
      <h2 className="text-center text-[30px] leading-[1.1] font-semibold sm:text-[38px]">
        Staying fit just got easier.
      </h2>
      {/* Figma's 877 px cards: 80 px padding + 325 px tile + 236 px copy, spread apart (156 px at full width). */}
      <ul className="mx-auto mt-[58px] flex max-w-[877px] flex-col gap-5">
        {FEATURES.map((f) => (
          <li
            key={f.icon}
            className="rounded-[16px] bg-fitr8-soft px-6 py-10 md:px-20 md:py-[60px]"
          >
            <div
              className={`flex flex-col items-center justify-center gap-10 md:justify-between ${
                f.imageFirst ? "md:flex-row" : "md:flex-row-reverse"
              }`}
            >
              {/* Figma's 325 × 260 tile. */}
              <div
                className={`relative h-[260px] w-full max-w-[325px] shrink-0 overflow-hidden bg-white ${f.tileRounded ? "rounded-[8px]" : ""}`}
              >
                {f.mockup && (
                  <div className="absolute top-0 left-1/2 h-[260px] w-[325px] -translate-x-1/2">
                    <Image
                      src={f.mockup.src}
                      alt=""
                      width={Math.round(f.mockup.width * 1.4)}
                      height={Math.round(f.mockup.height * 1.4)}
                      className={`absolute max-w-none object-cover ${f.mockup.className}`}
                    />
                  </div>
                )}
              </div>
              <div className="flex w-full flex-col gap-[18px] md:max-w-[236px]">
                <Image src={f.icon} alt="" width={54} height={54} className={f.iconClassName} />
                <div className="flex flex-col gap-[15px]">
                  <h3 className="text-[28px] leading-[1.35] font-bold text-fitr8-ink">
                    {f.title[0]}
                    {f.title[1] && (
                      <>
                        <br />
                        {f.title[1]}
                      </>
                    )}
                  </h3>
                  <p className="text-[16px] leading-[1.55] font-medium text-fitr8-ink/55">
                    {f.body}
                  </p>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
