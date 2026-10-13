/** Kicker + heading on the left, one supporting line on the right. */
export function SectionHead({
  kicker,
  title,
  aside,
  id,
}: {
  kicker: string;
  title: React.ReactNode;
  aside?: string;
  id?: string;
}) {
  return (
    <div className="mb-10 flex flex-wrap items-end justify-between gap-x-10 gap-y-4">
      <div>
        <p className="mb-3 text-[13px] font-semibold tracking-[0.08em] text-fitr8 uppercase">
          {kicker}
        </p>
        <h2
          id={id}
          className="max-w-[16em] text-[34px] leading-[1.1] font-semibold tracking-[-0.025em] text-balance sm:text-[48px]"
        >
          {title}
        </h2>
      </div>
      {aside && <p className="max-w-[30em] text-[17px] text-ink-2">{aside}</p>}
    </div>
  );
}

/** A word on the brand pill (white text on purple), used inside light-section headings. */
export function PillWord({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-[10px] bg-fitr8 [box-decoration-break:clone] px-[0.28em] pt-[0.04em] pb-[0.1em] text-white">
      {children}
    </span>
  );
}
