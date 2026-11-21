import Link from "next/link";
import type { BlogAuthorDto } from "@fitr8/contracts";

/** Website / X / LinkedIn links of an author (also their schema.org sameAs). */
export function authorLinks(a: Pick<BlogAuthorDto, "website" | "twitter" | "linkedin">) {
  const links: { label: string; href: string }[] = [];
  if (a.website) links.push({ label: "Website", href: a.website });
  if (a.twitter) links.push({ label: "X", href: `https://x.com/${a.twitter.replace(/^@/, "")}` });
  if (a.linkedin) links.push({ label: "LinkedIn", href: a.linkedin });
  return links;
}

/** "Written by" card under a post. */
export function AuthorBox({ author }: { author: BlogAuthorDto }) {
  return (
    <aside className="mt-12 flex gap-4 rounded-[20px] bg-fitr8-soft p-6">
      {author.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- served by the API
        <img src={author.avatarUrl} alt="" className="size-14 shrink-0 rounded-full object-cover" />
      ) : (
        <div className="grid size-14 shrink-0 place-items-center rounded-full bg-fitr8 text-xl font-bold text-white">
          {author.name.slice(0, 1)}
        </div>
      )}
      <div>
        <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
          Written by
        </p>
        <p className="mt-0.5 text-lg font-semibold">
          <Link href={`/blog/author/${author.slug}`} className="hover:text-fitr8 hover:underline">
            {author.name}
          </Link>
        </p>
        {author.bio && <p className="mt-1 text-[15px] text-ink-2">{author.bio}</p>}
      </div>
    </aside>
  );
}
