import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BlogCategoryDto, BlogPostPageDto } from "@fitr8/contracts";
import { blogGet, blogGetOr } from "@/lib/server/blog";
import { siteUrl } from "@/lib/site-url";
import { BlogShell, Crumbs } from "../../_components/blog-shell";
import { JsonLd } from "../../_components/json-ld";
import { pageParam } from "../../_components/page-param";
import { EmptyPosts, Pagination, PostGrid } from "../../_components/post-card";
import { TopicBar } from "../../_components/topic-bar";

export async function generateMetadata({
  params,
  searchParams,
}: PageProps<"/blog/category/[slug]">): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const r = await blogGet<BlogCategoryDto>(`/categories/${encodeURIComponent(slug)}`);
  if (!r.ok) return { title: "Category not found | FITR8 Blog", robots: { index: false } };
  const c = r.data;
  const page = pageParam(sp.page);
  const title = c.metaTitle || `${c.name}: articles and guides | FITR8 Blog`;
  const description =
    c.metaDescription || c.description || `FITR8 articles about ${c.name.toLowerCase()}.`;
  const path = `/blog/category/${c.slug}${page > 1 ? `?page=${page}` : ""}`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: siteUrl(path) },
    openGraph: { type: "website", url: siteUrl(path), title, description, siteName: "FITR8" },
  };
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/blog/category/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = pageParam(sp.page);
  const [cat, list, categories] = await Promise.all([
    blogGet<BlogCategoryDto>(`/categories/${encodeURIComponent(slug)}`),
    blogGetOr<BlogPostPageDto>(`/posts?category=${encodeURIComponent(slug)}&page=${page}`, {
      posts: [],
      page,
      pages: 1,
      total: 0,
    }),
    blogGetOr<BlogCategoryDto[]>("/categories", []),
  ]);
  if (!cat.ok) notFound();
  const c = cat.data;

  return (
    <BlogShell
      eyebrow={<Crumbs items={[{ href: "/blog", label: "Blog" }, { label: c.name }]} />}
      title={c.name}
      intro={c.description}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Blog", item: siteUrl("/blog") },
            {
              "@type": "ListItem",
              position: 2,
              name: c.name,
              item: siteUrl(`/blog/category/${c.slug}`),
            },
          ],
        }}
      />
      <div className="mx-auto max-w-[1300px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <TopicBar categories={categories} active={c.slug} />
        <div className="mt-8">
          {list.posts.length ? (
            <PostGrid posts={list.posts} />
          ) : (
            <EmptyPosts>No posts here yet.</EmptyPosts>
          )}
          <Pagination page={list.page} pages={list.pages} base={`/blog/category/${c.slug}`} />
        </div>
      </div>
    </BlogShell>
  );
}
