import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BlogPostPageDto, BlogTagDto } from "@fitr8/contracts";
import { blogGet, blogGetOr } from "@/lib/server/blog";
import { siteUrl } from "@/lib/site-url";
import { BlogShell, Crumbs } from "../../_components/blog-shell";
import { pageParam } from "../../_components/page-param";
import { EmptyPosts, Pagination, PostGrid } from "../../_components/post-card";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/blog/tag/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const r = await blogGet<BlogTagDto>(`/tags/${encodeURIComponent(slug)}`);
  if (!r.ok) return { title: "Tag not found | FITR8 Blog", robots: { index: false } };
  const page = pageParam(sp.page);
  const path = `/blog/tag/${r.data.slug}${page > 1 ? `?page=${page}` : ""}`;
  const title = `${r.data.name} | FITR8 Blog`;
  const description = r.data.description || `FITR8 posts tagged ${r.data.name}.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: siteUrl(path) },
    openGraph: { type: "website", url: siteUrl(path), title, description, siteName: "FITR8" },
  };
}

export default async function TagPage({ params, searchParams }: PageProps<"/blog/tag/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = pageParam(sp.page);
  const [tag, list] = await Promise.all([
    blogGet<BlogTagDto>(`/tags/${encodeURIComponent(slug)}`),
    blogGetOr<BlogPostPageDto>(`/posts?tag=${encodeURIComponent(slug)}&page=${page}`, {
      posts: [],
      page,
      pages: 1,
      total: 0,
    }),
  ]);
  if (!tag.ok) notFound();
  return (
    <BlogShell
      eyebrow={<Crumbs items={[{ href: "/blog", label: "Blog" }, { label: "Tag" }]} />}
      title={`#${tag.data.name}`}
      intro={tag.data.description}
    >
      <div className="mx-auto max-w-[1300px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        {list.posts.length ? (
          <PostGrid posts={list.posts} />
        ) : (
          <EmptyPosts>No posts here yet.</EmptyPosts>
        )}
        <Pagination page={list.page} pages={list.pages} base={`/blog/tag/${tag.data.slug}`} />
      </div>
    </BlogShell>
  );
}
