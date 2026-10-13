"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

type Story = {
  name: string;
  quote: string;
  photo: string;
  alt: string;
  /** Focal point for object-position, so the face stays in frame in every slot. */
  focus: string;
};

// Only Rahul's quote is in Figma; the other four are placeholder reviews for design review.
const STORIES: Story[] = [
  {
    name: "Rahul Srivastav",
    quote:
      "I used to focus only on my weight. Now I pay attention to my nutrition, strength, and overall progress. It gives me a much clearer picture of my journey.",
    photo: "/landing/testimonial-main.jpg",
    alt: "Rahul training with a cable machine",
    focus: "50% 25%",
  },
  {
    name: "Ananya Iyer",
    quote:
      "Logging a meal is just a photo now. For the first time I’ve kept tracking going past the first week, and my energy through the day feels so much steadier.",
    photo: "/landing/testimonial-side-3.jpg",
    alt: "Ananya smiling after a workout",
    focus: "40% 35%",
  },
  {
    name: "Meera Kapoor",
    quote:
      "I train for half marathons, and FITR8 shows me how my food lines up with my runs. My recovery between long runs feels completely different.",
    photo: "/landing/testimonial-side-4.jpg",
    alt: "Meera out on a run",
    focus: "60% 45%",
  },
  {
    name: "Priya Sharma",
    quote:
      "Scanning packaged snacks opened my eyes. A few small swaps added up, and I’m down 4 kg without ever feeling like I’m on a diet.",
    photo: "/landing/testimonial-side-2.jpg",
    alt: "Priya smiling at the camera",
    focus: "50% 35%",
  },
  {
    name: "Kavya Nair",
    quote:
      "The workout targets keep me honest. Every week I can see my lifts creeping up, and seeing that progress is what keeps me coming back.",
    photo: "/landing/testimonial-side-1.jpg",
    alt: "Kavya resting between sets",
    focus: "48% 35%",
  },
];

const AUTOPLAY_MS = 2000;
const at = (i: number) => STORIES[((i % STORIES.length) + STORIES.length) % STORIES.length];

/**
 * Figma 3821:2115 as a carousel: the active story fills the centre card, and the next two (right)
 * and previous two (left) sit in the phone stacks. The left stack is the right one mirrored, with
 * its photos flipped back. Click a side photo or a dot, swipe, or let it advance every 6 s.
 */
export function Testimonials() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchX = useRef<number | null>(null);
  // Direction of the last move: forward slides in from the right, back from the left.
  const [dir, setDir] = useState<1 | -1>(1);
  const go = useCallback((step: number) => {
    if (step === 0) return;
    setDir(step > 0 ? 1 : -1);
    setIndex((i) => i + step);
  }, []);
  const slide =
    dir > 0
      ? "animate-[slide-from-right_450ms_ease-out]"
      : "animate-[slide-from-left_450ms_ease-out]";
  const active = at(index);
  const activeDot = ((index % STORIES.length) + STORIES.length) % STORIES.length;

  useEffect(() => {
    if (paused || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => go(1), AUTOPLAY_MS);
    return () => window.clearInterval(id);
  }, [paused, go, index]);

  return (
    <section
      id="results"
      aria-roledescription="carousel"
      aria-label="What FITR8 users say"
      className="flex scroll-mt-16 flex-col items-center justify-center gap-12 bg-gradient-to-b from-fitr8 to-fitr8-lilac px-4 py-16 lg:h-[798px] lg:p-[10px]"
      // Keyboard focus pauses too; a mouse click on a dot or photo shouldn't freeze it.
      onFocus={(e) => e.target.matches(":focus-visible") && setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <h2 className="max-w-[680px] text-center text-[30px] leading-[1.1] font-semibold text-white sm:text-[38px]">
        FITR8 works.
        <br />
        Their progress proves it.
      </h2>

      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex w-full items-center justify-center">
          <PhoneStack
            mirrored
            className="mr-[-22px]"
            big={at(index - 1)}
            small={at(index - 2)}
            onBig={() => go(-1)}
            onSmall={() => go(-2)}
          />

          <figure
            key={active.name}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
            aria-live={paused ? "polite" : "off"}
            className={`relative z-10 flex w-full max-w-[652px] ${slide} flex-col-reverse gap-6 overflow-hidden rounded-[16px] bg-white p-7 sm:h-[420px] sm:flex-row sm:p-0 lg:mr-[-22px]`}
            onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
            onTouchEnd={(e) => {
              if (touchX.current === null) return;
              const dx = e.changedTouches[0].clientX - touchX.current;
              touchX.current = null;
              if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            }}
          >
            <div className="flex flex-col sm:absolute sm:top-7 sm:left-7 sm:h-[364px] sm:w-[274px]">
              <blockquote className="w-full max-w-[236px] font-playfair text-[22px] leading-[1.35] font-medium text-black italic">
                “{active.quote}”
              </blockquote>
              <figcaption className="mt-6 text-right text-[14px] leading-[1.55] font-medium text-black/55 sm:absolute sm:top-[342px] sm:right-0 sm:mt-0">
                -{active.name}
              </figcaption>
            </div>
            <div className="relative h-[364px] w-full shrink-0 overflow-hidden rounded-[16px] sm:absolute sm:top-7 sm:left-[323px] sm:w-[301px]">
              <Image
                src={active.photo}
                alt={active.alt}
                fill
                sizes="(min-width: 640px) 301px, 100vw"
                className="object-cover"
                style={{ objectPosition: active.focus }}
              />
            </div>
          </figure>

          <PhoneStack
            big={at(index + 1)}
            small={at(index + 2)}
            onBig={() => go(1)}
            onSmall={() => go(2)}
          />
        </div>

        <div className="flex gap-2" role="group" aria-label="Choose a story">
          {STORIES.map((s, i) => (
            <button
              key={s.name}
              type="button"
              aria-label={`Show ${s.name}’s story`}
              aria-current={i === activeDot}
              onClick={() => go(i - activeDot)}
              className={`h-2 rounded-full bg-white transition-all ${
                i === activeDot ? "w-6" : "w-2 opacity-50 hover:opacity-80"
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/** 229 × 286 group: tall phone, two white blobs, short phone (Figma 3821:2106). Desktop only. */
function PhoneStack({
  big,
  small,
  onBig,
  onSmall,
  mirrored = false,
  className = "",
}: {
  big: Story;
  small: Story;
  onBig: () => void;
  onSmall: () => void;
  mirrored?: boolean;
  className?: string;
}) {
  const flip = mirrored ? "-scale-x-100" : "";
  return (
    <div
      className={`relative hidden h-[286px] w-[229.44px] shrink-0 lg:block ${flip} ${className}`}
    >
      <button
        type="button"
        onClick={onBig}
        aria-label={`Show ${big.name}’s story`}
        className="absolute top-0 left-[47px] h-[286px] w-[95px] overflow-hidden rounded-[24px] bg-white transition-transform hover:scale-[1.03]"
      >
        <span className="absolute top-[19px] left-[18.84px] h-[248px] w-[57px] overflow-hidden rounded-[16px] bg-white">
          <StackPhoto story={big} flip={flip} />
        </span>
      </button>
      <Image
        src="/landing/deco-left.svg"
        alt=""
        width={64}
        height={24}
        className="pointer-events-none absolute top-[132.6px] left-0 h-[23.59px] w-[64px]"
      />
      <Image
        src="/landing/deco-right.svg"
        alt=""
        width={48}
        height={18}
        className="pointer-events-none absolute top-[134.95px] left-[129px] h-[17.69px] w-[48px]"
      />
      <button
        type="button"
        onClick={onSmall}
        aria-label={`Show ${small.name}’s story`}
        className="absolute top-[48px] left-[166px] h-[191px] w-[63.44px] overflow-hidden rounded-[18px] bg-white transition-transform hover:scale-[1.04]"
      >
        <span className="absolute top-[12.69px] left-[12.58px] h-[165.62px] w-[38.07px] overflow-hidden rounded-[10.685px] bg-white">
          <StackPhoto story={small} flip={flip} />
        </span>
      </button>
    </div>
  );
}

function StackPhoto({ story, flip }: { story: Story; flip: string }) {
  return (
    <Image
      key={story.photo}
      src={story.photo}
      alt=""
      fill
      sizes="120px"
      className={`animate-[fade-in_400ms_ease-out] object-cover ${flip}`}
      style={{ objectPosition: story.focus }}
    />
  );
}
