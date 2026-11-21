/** Plain share links (no third-party scripts). */
export function ShareLinks({ url, title }: { url: string; title: string }) {
  const u = encodeURIComponent(url);
  const t = encodeURIComponent(title);
  const links = [
    { label: "WhatsApp", href: `https://wa.me/?text=${t}%20${u}` },
    { label: "X", href: `https://x.com/intent/post?url=${u}&text=${t}` },
    { label: "LinkedIn", href: `https://www.linkedin.com/sharing/share-offsite/?url=${u}` },
    { label: "Facebook", href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];
  return (
    <div className="mt-10 flex flex-wrap items-center gap-2">
      <span className="mr-1 text-[13px] font-semibold text-ink-3">Share</span>
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          className="flex h-9 items-center rounded-full border border-line-strong px-4 text-[14px] font-semibold hover:border-fitr8 hover:text-fitr8"
        >
          {l.label}
        </a>
      ))}
    </div>
  );
}
