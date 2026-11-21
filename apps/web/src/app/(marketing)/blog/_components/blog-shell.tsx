import Link from "next/link";
import { SiteFooter } from "../../_components/site-footer";
import { SiteHeader } from "../../_components/site-header";

/** Site header, a purple intro band and the footer around every /blog page. */
export function BlogShell({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <section className="bg-fitr8 text-white">
        <div className="mx-auto max-w-[1300px] px-4 pt-10 pb-14 sm:px-6 lg:px-10 lg:pt-14 lg:pb-20">
          {eyebrow && (
            // A div, not a p: the eyebrow can be the breadcrumb <nav>, which a <p> can't contain.
            <div className="text-[13px] font-semibold tracking-[0.08em] text-fitr8-lilac uppercase">
              {eyebrow}
            </div>
          )}
          <h1 className="mt-3 max-w-[18em] text-[38px] leading-[1.08] font-semibold tracking-[-0.03em] text-balance sm:text-[52px]">
            {title}
          </h1>
          {intro && <div className="mt-4 max-w-[38em] text-lg text-white/80">{intro}</div>}
        </div>
      </section>
      <main className="bg-white">{children}</main>
      <SiteFooter />
    </>
  );
}

/** Breadcrumb trail: Blog › Category. */
export function Crumbs({ items }: { items: { href?: string; label: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-[13px] font-semibold text-fitr8-lilac">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((c, i) => (
          <li key={c.label} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>›</span>}
            {c.href ? (
              <Link href={c.href} className="hover:text-white hover:underline">
                {c.label}
              </Link>
            ) : (
              <span aria-current="page" className="text-white/90">
                {c.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
