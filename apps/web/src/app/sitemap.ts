import type { MetadataRoute } from "next";
import type { BlogSitemapDto } from "@fitr8/contracts";
import { blogGetOr } from "@/lib/server/blog";
import { siteUrl } from "@/lib/site-url";

/** Built per request from the API; if it's unreachable, the static pages still list. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blog = await blogGetOr<BlogSitemapDto>("/sitemap", {
    posts: [],
    categories: [],
    tags: [],
    authors: [],
  });
  const latest = blog.posts[0]?.updatedAt;
  return [
    { url: siteUrl("/"), changeFrequency: "weekly", priority: 1 },
    { url: siteUrl("/blog"), lastModified: latest, changeFrequency: "daily", priority: 0.9 },
    ...blog.posts.map((p) => ({
      url: siteUrl(`/blog/${p.slug}`),
      lastModified: p.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
    ...blog.categories.map((c) => ({
      url: siteUrl(`/blog/category/${c.slug}`),
      lastModified: c.updatedAt,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
    ...blog.tags.map((t) => ({
      url: siteUrl(`/blog/tag/${t.slug}`),
      changeFrequency: "weekly" as const,
      priority: 0.4,
    })),
    ...blog.authors.map((a) => ({
      url: siteUrl(`/blog/author/${a.slug}`),
      changeFrequency: "monthly" as const,
      priority: 0.4,
    })),
    { url: siteUrl("/privacy"), changeFrequency: "yearly", priority: 0.2 },
    { url: siteUrl("/terms"), changeFrequency: "yearly", priority: 0.2 },
  ];
}
