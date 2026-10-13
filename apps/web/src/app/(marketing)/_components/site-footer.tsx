import Image from "next/image";
import { Fitr8Wordmark } from "@/components/fitr8-wordmark";
import { CONTACT_EMAIL } from "./faq";

// Link targets and social profiles aren't decided yet, so these render as plain text / icons.
const COMPANY_LINKS = [
  "About us",
  "Reviews",
  "Privacy Policy",
  "Pricing and Refund Policy",
  "Terms & Condition",
];
const SOCIALS = [
  { icon: "/landing/social-linkedin.svg", label: "LinkedIn" },
  { icon: "/landing/social-youtube.svg", label: "YouTube" },
  { icon: "/landing/social-instagram.svg", label: "Instagram" },
  { icon: "/landing/social-quora.svg", label: "Quora" },
];

/** White → slate gradient used on the two column headings. */
const headingGradient =
  "w-fit bg-[linear-gradient(94deg,#fff_2.6%,#7b8ca6_150%)] bg-clip-text text-transparent";

/** Figma 3823:2177. */
export function SiteFooter() {
  return (
    <footer className="bg-fitr8-footer px-6 py-16 leading-[normal] lg:px-[120px]">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-6">
        <div className="flex flex-col justify-between gap-12 md:flex-row md:items-start">
          <div className="flex w-full max-w-[375px] flex-col gap-10">
            <div className="flex flex-col gap-6">
              <Fitr8Wordmark />
              <p className="max-w-[312px] text-[14px] leading-[1.5] text-fitr8-footer-text">
                Helping you eat smarter, train better &amp; see real progress, all in one app.
              </p>
            </div>
            <div className="flex flex-col gap-[13px]">
              <p className="text-[12px] font-semibold tracking-[2.52px] text-white/40 uppercase">
                Follow Us
              </p>
              <ul className="flex gap-3">
                {SOCIALS.map((s) => (
                  <li key={s.label} className="rounded-[4.8px] bg-white/10 p-[7.2px]">
                    <Image
                      src={s.icon}
                      alt={s.label}
                      width={29}
                      height={29}
                      className="size-[28.8px]"
                    />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="flex flex-col gap-10 text-[14px] sm:flex-row">
            <div className="flex flex-col gap-6">
              <p className={`font-semibold uppercase ${headingGradient}`}>Who are we</p>
              <ul className="flex w-[177px] flex-col gap-3 text-white/70">
                {COMPANY_LINKS.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
            </div>
            {/* Figma draws the divider as a horizontal gradient line rotated 90°. */}
            <span aria-hidden className="relative hidden h-[145.47px] w-0 sm:block">
              <Image
                src="/landing/footer-divider.svg"
                alt=""
                width={146}
                height={1}
                className="absolute top-0 left-0 h-px w-[145.47px] max-w-none origin-top-left translate-x-px rotate-90"
              />
            </span>
            <div className="flex w-full max-w-[282px] flex-col gap-6 sm:w-[282px]">
              <p className={`font-semibold uppercase ${headingGradient}`}>Contact Us</p>
              <address className="flex flex-col gap-6 text-white/70 not-italic">
                <a href={`mailto:${CONTACT_EMAIL}`}>E-mail: {CONTACT_EMAIL}</a>
                <p className="max-w-[260px] leading-[1.3]">
                  House No-61, Gali No-2, Near Narayan Farm House,
                  <br />
                  Akash Nagar, Ghaziabad
                </p>
              </address>
            </div>
          </div>
        </div>

        <hr className="border-white/10" />

        <div className="flex flex-col justify-between gap-2 text-[12px] text-fitr8-footer-text opacity-40 sm:flex-row">
          <p>©️ 2026 Fitr8 Health &amp; Wellness Pvt. Ltd. All rights reserved.</p>
          <p>Site Map</p>
        </div>
      </div>
    </footer>
  );
}
