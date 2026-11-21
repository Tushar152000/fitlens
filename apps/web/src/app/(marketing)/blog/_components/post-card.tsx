import Link from "next/link";
import type { BlogPostSummaryDto } from "@fitr8/contracts";
import { cn } from "@/lib/cn";
import { formatPostDate } from "./format";

/** One post in a grid. `large` = the featured slot at the top of /blog. */
export function PostCard({ post, large }: { post: BlogPostSummaryDto; large?: boolean }) {
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-[20px] border border-line bg-white transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 hover:shadow-hard-sm",
        large && "md:grid md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]",
      )}
    >
      <div
        className={cn(
          "aspect-[16/9] bg-fitr8-lilac-soft",
          large && "md:aspect-auto md:min-h-[320px]",
        )}
      >
        {post.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- images are served by the API with long caching
          <img
            src={post.coverUrl}
            alt={post.coverAlt ?? ""}
            loading={large ? "eager" : "lazy"}
            className="size-full object-cover"
          />
        ) : (
          <div className="grid size-full place-items-center text-[40px] font-extrabold text-fitr8/25">
            FITR8
          </div>
        )}
      </div>
      <div className={cn("flex flex-1 flex-col p-5", large && "md:p-8")}>
        {post.category && (
          <p className="text-[12px] font-semibold tracking-[0.08em] text-fitr8 uppercase">
            {post.category.name}
          </p>
        )}
        <h2
          className={cn(
            "mt-2 font-semibold tracking-[-0.02em] text-fitr8-ink",
            large ? "text-[28px] leading-[1.15] md:text-[34px]" : "text-[20px] leading-[1.25]",
          )}
        >
          <Link href={`/blog/${post.slug}`} className="after:absolute after:inset-0">
            {post.title}
          </Link>
        </h2>
        {post.excerpt && (
          <p className={cn("mt-2 text-ink-2", large ? "text-lg" : "line-clamp-3 text-[15px]")}>
            {post.excerpt}
          </p>
        )}
        <p className="mt-auto pt-4 text-[13px] font-semibold text-ink-3">
          {[post.author?.name, formatPostDate(post.publishedAt), `${post.readingMinutes} min read`]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
    </article>
  );
}

export function PostGrid({ posts }: { posts: BlogPostSummaryDto[] }) {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {posts.map((p) => (
        <PostCard key={p.id} post={p} />
      ))}
    </div>
  );
}

/** "Page 2 of 5" with older/newer links. */
export function Pagination({ page, pages, base }: { page: number; pages: number; base: string }) {
  if (pages <= 1) return null;
  const href = (n: number) => (n === 1 ? base : `${base}?page=${n}`);
  const link =
    "flex h-11 items-center rounded-full border border-line-strong px-5 text-[15px] font-semibold hover:border-fitr8 hover:text-fitr8";
  return (
    <nav aria-label="Pages" className="mt-12 flex items-center justify-center gap-3">
      {page > 1 && (
        <Link href={href(page - 1)} rel="prev" className={link}>
          Newer
        </Link>
      )}
      <span className="text-[14px] font-semibold text-ink-3">
        Page {page} of {pages}
      </span>
      {page < pages && (
        <Link href={href(page + 1)} rel="next" className={link}>
          Older
        </Link>
      )}
    </nav>
  );
}

export function EmptyPosts({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[20px] border border-dashed border-line-strong p-10 text-center text-ink-2">
      {children}
    </div>
  );
}
