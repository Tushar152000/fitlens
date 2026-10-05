import Image from "next/image";
import Link from "next/link";
import { Fitr8Wordmark } from "@/components/fitr8-wordmark";

/**
 * Figma 3803:1747 + backdrop. On desktop the frame is 1440 × 690: a 214 px purple strip, then the
 * plate photo with a purple → transparent gradient over its left 770 px and the outline shape at
 * x 789. Below lg the photo sits behind a stronger purple wash and the copy stacks.
 */
export function Hero() {
  return (
    <section className="relative overflow-hidden bg-fitr8">
      <div className="relative mx-auto max-w-[1440px] lg:h-[690px]">
        {/* Backdrop. Percentages are the Figma offsets over the 1440 frame. */}
        <div
          aria-hidden
          className="absolute inset-0 lg:top-[-57px] lg:bottom-[-71px] lg:left-[14.86%]"
        >
          <Image
            src="/landing/hero-plate.jpg"
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) 85vw, 100vw"
            className="object-cover"
          />
        </div>
        <div
          aria-hidden
          className="absolute inset-0 bg-fitr8/80 lg:right-auto lg:left-[14.86%] lg:w-[53.47%] lg:bg-transparent lg:bg-gradient-to-l lg:from-fitr8/0 lg:to-fitr8"
        />
        {/* Frosted "glass" shape (547 × 516 at x 789). Figma exports only its 10% white fill, not the
            background blur, so an opaque copy of the shape masks a blurred 10% white panel. */}
        <div
          aria-hidden
          className="absolute top-[50px] left-[54.79%] hidden aspect-[547/516] w-[37.97%] bg-white/10 backdrop-blur-[2px] lg:block"
          style={{
            maskImage: "url(/landing/hero-outline-mask.svg)",
            maskSize: "100% 100%",
            WebkitMaskImage: "url(/landing/hero-outline-mask.svg)",
            WebkitMaskSize: "100% 100%",
          }}
        />

        <div className="relative flex items-center gap-[223px] px-6 pt-[50px] pb-16 lg:pb-0 lg:pl-[15.42%]">
          <div className="flex w-full max-w-[539px] flex-col gap-[68px]">
            <Fitr8Wordmark />

            <div className="flex flex-col gap-8">
              <h1 className="flex flex-col items-start gap-[11px] text-[34px] leading-[1.1] font-bold text-white sm:text-[48px]">
                <span>The World’s</span>
                <span className="rounded-[8px] bg-white px-[14px] py-[12px] text-fitr8 sm:whitespace-nowrap">
                  #1 Nutrition &amp; Progress
                </span>
                <span>tracking app</span>
              </h1>

              <div className="flex flex-col gap-8">
                <p className="max-w-[499px] text-[14px] leading-[1.1] font-medium text-white lowercase">
                  Track your meals, log your workouts, and discover what to do next. Everything you
                  need to reach your fitness goals, all in one place.
                </p>
                <Link
                  href="/welcome"
                  className="flex h-12 w-[276px] items-center justify-center gap-2 rounded-full bg-white font-roboto text-[16px] leading-5 font-bold tracking-[0.1px] text-fitr8"
                >
                  START FOR FREE
                  <Image
                    src="/landing/icon-chevron.svg"
                    alt=""
                    width={24}
                    height={24}
                    className="rotate-90"
                  />
                </Link>
              </div>
            </div>
          </div>

          <div className="relative hidden h-[284px] w-[236px] shrink-0 lg:block">
            <Image
              src="/landing/qr-code.png"
              alt="QR code to download the FITR8 app"
              width={230}
              height={230}
              className="absolute top-0 left-0 size-[230px] rounded-[11px] shadow-[10px_10px_0_0_var(--color-fitr8-deep)]"
            />
            <StoreBadges className="absolute top-[250px] left-0" />
          </div>
        </div>

        <StoreBadges className="relative px-6 pb-10 lg:hidden" />
      </div>
    </section>
  );
}

/** App Store (102 × 34) and Google Play (114 × 34) badges, 20 px apart, hard purple shadow. */
function StoreBadges({ className }: { className?: string }) {
  return (
    <div className={`flex gap-5 ${className ?? ""}`}>
      <Image
        src="/landing/badge-app-store.png"
        alt="Download on the App Store"
        width={102}
        height={34}
        className="h-[34px] w-[102px] object-cover shadow-[4px_4px_0_0_var(--color-fitr8-deep)]"
      />
      <span className="relative h-[34px] w-[114px] overflow-hidden shadow-[4px_4px_0_0_var(--color-fitr8-deep)]">
        {/* Figma crops the Play badge: 114.04% wide, offset −7.02% / −23.98%. */}
        <Image
          src="/landing/badge-google-play.png"
          alt="Get it on Google Play"
          width={130}
          height={50}
          className="absolute top-[-23.98%] left-[-7.02%] h-[147.97%] w-[114.04%] max-w-none"
        />
      </span>
    </div>
  );
}
