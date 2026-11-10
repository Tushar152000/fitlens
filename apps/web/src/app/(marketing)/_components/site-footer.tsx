import Link from "next/link";
import { CONTACT_EMAIL } from "./faq";

const COMPANY_LINKS = [
  { label: "Reviews", href: "/#stories" },
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Use", href: "/terms" },
];
/** Dark footer (extra bottom padding clears the section dock): wordmark, live links and contact. */
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
          </div>
          <div>
            <h2 className="mb-3.5 text-[13px] font-semibold tracking-[0.08em] text-fitr8-lilac uppercase">
              Who are we
            </h2>
            <ul className="flex flex-col gap-2.5">
              {COMPANY_LINKS.map((l) => (
                <li key={l.label}>
                  <Link href={l.href} className="hover:text-white hover:underline">
                    {l.label}
                  </Link>
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
