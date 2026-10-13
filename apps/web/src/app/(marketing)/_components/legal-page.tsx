import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";

/** Shared frame for /privacy and /terms: site header and footer, one readable column. */
export function LegalPage({
  title,
  updated,
  intro,
  children,
}: {
  title: string;
  /** e.g. "14 October 2026" */
  updated: string;
  intro: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="bg-white">
        <article className="mx-auto max-w-[760px] px-4 py-14 sm:px-6 sm:py-20 [&_a]:font-semibold [&_a]:text-fitr8 [&_a]:underline-offset-4 hover:[&_a]:underline [&_h2]:mt-10 [&_h2]:mb-3 [&_h2]:text-[24px] [&_h2]:leading-tight [&_h2]:font-semibold [&_h2]:tracking-[-0.02em] [&_h3]:mt-6 [&_h3]:mb-2 [&_h3]:font-semibold [&_li]:mt-1.5 [&_p]:mt-3 [&_p]:text-ink-2 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:text-ink-2">
          <p className="!mt-0 text-[13px] font-semibold tracking-[0.08em] !text-fitr8 uppercase">
            Last updated {updated}
          </p>
          <h1 className="mt-3 text-[38px] leading-[1.1] font-semibold tracking-[-0.025em] sm:text-[48px]">
            {title}
          </h1>
          <div className="mt-5 text-lg text-ink-2">{intro}</div>
          {children}
        </article>
      </main>
      <SiteFooter />
    </>
  );
}
