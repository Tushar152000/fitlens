import Link from "next/link";
import { notFound } from "next/navigation";
import type { BlogAdminPostDto, BlogCategoryDto, BlogTagDto } from "@fitr8/contracts";
import { Article } from "@/components/blog/article";
import { StatusBadge } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";
import { marketingFontVars } from "@/lib/fitr8-fonts";
import { ApiError } from "@/lib/server/api";

export const metadata = { title: "Preview" };

/** The post as readers will see it, before it's live. */
export default async function PreviewPost({ params }: PageProps<"/admin/blog/posts/[id]/preview">) {
  const [{ id }] = await Promise.all([params, requireStaff()]);
  const [post, categories, tags] = await Promise.all([
    blogServerApi<BlogAdminPostDto>(`/posts/${encodeURIComponent(id)}`).catch((err) => {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }),
    blogServerApi<BlogCategoryDto[]>("/categories"),
    blogServerApi<BlogTagDto[]>("/tags"),
  ]);
  if (!post) notFound();
  const category = categories.find((c) => c.id === post.categoryId) ?? null;
  const postTags = tags.filter((t) => post.tagIds.includes(t.id));

  return (
    <div
      className={`${marketingFontVars} -mx-4 -my-6 font-jakarta text-fitr8-ink sm:-mx-6 lg:-mx-10 lg:-my-10`}
    >
      <div className="flex items-center gap-3 bg-ink px-4 py-2.5 text-[14px] text-white">
        <StatusBadge status={post.status} />
        Preview: this is how the post will look.
        <Link href={`/admin/blog/posts/${post.id}`} className="ml-auto font-semibold underline">
          Back to editing
        </Link>
      </div>
      <section className="bg-fitr8 text-white">
        <div className="mx-auto max-w-[1300px] px-4 pt-10 pb-14 sm:px-6 lg:px-10">
          {category && (
            <p className="text-[13px] font-semibold tracking-[0.08em] text-fitr8-lilac uppercase">
              {category.name}
            </p>
          )}
          <h1 className="mt-3 max-w-[18em] text-[38px] leading-[1.08] font-semibold tracking-[-0.03em] sm:text-[52px]">
            {post.title}
          </h1>
          {post.excerpt && (
            <p className="mt-4 max-w-[38em] text-lg text-white/80">{post.excerpt}</p>
          )}
        </div>
      </section>
      <div className="bg-white">
        <Article
          post={{
            title: post.title,
            excerpt: post.excerpt,
            contentHtml: post.contentHtml,
            toc: post.toc,
            faq: post.faq,
            coverUrl: post.cover?.url ?? null,
            coverAlt: post.coverAlt,
            readingMinutes: post.readingMinutes,
            category,
            tags: postTags,
            meta: `${post.readingMinutes} min read`,
          }}
        />
      </div>
    </div>
  );
}
