import Link from "next/link";
import type { BlogFaqItem, BlogTocEntry } from "@fitr8/contracts";

export interface ArticleData {
  title: string;
  excerpt: string | null;
  contentHtml: string;
  toc: BlogTocEntry[];
  faq: BlogFaqItem[];
  coverUrl: string | null;
  coverAlt: string | null;
  readingMinutes: number;
  category: { slug: string; name: string } | null;
  tags: { slug: string; name: string }[];
  /** Pre-formatted "Asha Rao · 22 Nov 2026 · 6 min read". */
  meta: string;
}

/**
 * A post as readers see it: title, cover, contents, body, FAQ, tags. Used by /blog/[slug] and the
 * admin preview. `contentHtml` is sanitised by the API before it is stored.
 */
export function Article({ post, children }: { post: ArticleData; children?: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1180px] px-4 py-10 sm:px-6 lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-14 lg:px-10 lg:py-14">
      <article className="min-w-0">
        {post.coverUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- served by the API with long caching
          <img
            src={post.coverUrl}
            alt={post.coverAlt ?? ""}
            className="mb-10 aspect-[16/9] w-full rounded-[20px] object-cover"
            fetchPriority="high"
          />
        )}
        <div className="blog-prose" dangerouslySetInnerHTML={{ __html: post.contentHtml }} />

        {post.faq.length > 0 && (
          <section aria-labelledby="faq" className="mt-14">
            <h2 id="faq" className="text-[28px] leading-tight font-semibold tracking-[-0.02em]">
              Frequently asked questions
            </h2>
            <div className="mt-5 divide-y divide-line rounded-[20px] border border-line">
              {post.faq.map((f) => (
                <details
                  key={f.question}
                  className="group p-5 [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="flex cursor-pointer items-center justify-between gap-4 text-lg font-semibold">
                    {f.question}
                    <span
                      aria-hidden
                      className="text-fitr8 transition-transform group-open:rotate-45"
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-3 whitespace-pre-line text-ink-2">{f.answer}</p>
                </details>
              ))}
            </div>
          </section>
        )}

        {post.tags.length > 0 && (
          <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
            {post.tags.map((t) => (
              <li key={t.slug}>
                <Link
                  href={`/blog/tag/${t.slug}`}
                  className="flex h-9 items-center rounded-full bg-fitr8-soft px-4 text-[14px] font-semibold text-fitr8-ink hover:bg-fitr8-lilac-soft"
                >
                  #{t.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        {children}
      </article>

      {post.toc.length > 1 && (
        <aside className="hidden lg:block">
          <nav aria-label="On this page" className="sticky top-24">
            <p className="text-[12px] font-semibold tracking-[0.08em] text-ink-3 uppercase">
              On this page
            </p>
            <ol className="mt-3 flex flex-col gap-2 border-l border-line">
              {post.toc.map((h) => (
                <li key={h.id} className={h.level === 3 ? "pl-7" : "pl-4"}>
                  <a href={`#${h.id}`} className="block text-[14px] text-ink-2 hover:text-fitr8">
                    {h.text}
                  </a>
                </li>
              ))}
            </ol>
          </nav>
        </aside>
      )}
    </div>
  );
}
