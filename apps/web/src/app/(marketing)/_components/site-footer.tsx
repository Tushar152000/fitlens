import Image from "next/image";
import Link from "next/link";
import { CONTACT_EMAIL } from "./faq";

// Pages not built yet stay plain text; social profiles aren't decided yet (icons only).
const COMPANY_LINKS: { label: string; href?: string }[] = [
  { label: "About us" },
  { label: "Reviews", href: "/#stories" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Pricing and Refund Policy" },
  { label: "Terms of Use", href: "/terms" },
];
const SOCIALS = [
  { icon: "/landing/social-linkedin.svg", label: "LinkedIn" },
  { icon: "/landing/social-youtube.svg", label: "YouTube" },
  { icon: "/landing/social-instagram.svg", label: "Instagram" },
  { icon: "/landing/social-quora.svg", label: "Quora" },
];

/** Dark footer (extra bottom padding clears the section dock): wordmark, line and socials; company links (pages not built yet); contact. */
export function SiteFooter() {
  return (
    <footer className="bg-fitr8-footer pt-14 pb-28 text-[15px] text-fitr8-footer-text">
      <div className="mx-auto max-w-[1300px] px-4 sm:px-6 lg:px-10">
        <div className="grid gap-8 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="text-2xl font-extrabold tracking-[-0.02em] text-white">
              FIT<span className="text-fitr8-lilac">R8</span>
            </p>
            <p className="mt-3 max-w-[26em]">
              Helping you eat smarter, train better and see real progress, all in one app.
            </p>
            <p className="mt-8 text-xs font-semibold tracking-[0.2em] text-white/40 uppercase">
              Follow us
            </p>
            <ul className="mt-3 flex gap-3">
              {SOCIALS.map((s) => (
                <li key={s.label}>
                  <Image src={s.icon} alt={s.label} width={29} height={29} />
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3.5 text-[13px] font-semibold tracking-[0.08em] text-fitr8-lilac uppercase">
              Who are we
            </h2>
            <ul className="flex flex-col gap-2.5">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  {l.href ? (
                    <Link href={l.href} className="hover:text-white hover:underline">
                      {l.label}
                    </Link>
                  ) : (
                    l.label
                  )}
                </li>
              ))}
            </ul>
          </div>
          <div>
            <h2 className="mb-3.5 text-[13px] font-semibold tracking-[0.08em] text-fitr8-lilac uppercase">
              Contact us
            </h2>
            <ul className="flex flex-col gap-2.5">
              <li>
                <a href={`mailto:${CONTACT_EMAIL}`} className="hover:text-white hover:underline">
                  Email: {CONTACT_EMAIL}
                </a>
              </li>
              <li>
                <address className="leading-relaxed not-italic">
                  House No-61, Gali No-2, Near Narayan Farm House, Akash Nagar, Ghaziabad
                </address>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-11 flex flex-wrap justify-between gap-3 border-t border-white/12 pt-[22px] text-[13px] text-[#8d8fa3]">
          <p>© 2026 Fitr8 Health &amp; Wellness Pvt. Ltd. All rights reserved.</p>
          <p>General fitness guidance, not medical advice.</p>
        </div>
      </div>
    </footer>
  );
}
