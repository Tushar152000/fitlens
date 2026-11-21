import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import type { BlogPostDto } from "@fitr8/contracts";
import { Article } from "@/components/blog/article";
import { blogGet } from "@/lib/server/blog";
import { siteUrl } from "@/lib/site-url";
import { AuthorBox, authorLinks } from "../_components/author-box";
import { BlogShell, Crumbs } from "../_components/blog-shell";
import { formatPostDate } from "../_components/format";
import { JsonLd } from "../_components/json-ld";
import { PostGrid } from "../_components/post-card";
import { ShareLinks } from "../_components/share-links";

/** The post, a 308 to where it moved, or 404. */
async function loadPost(slug: string): Promise<BlogPostDto> {
  const r = await blogGet<BlogPostDto>(`/posts/${encodeURIComponent(slug)}`);
  if (r.ok) return r.data;
  if (r.status === 404 && r.details?.redirectTo) permanentRedirect(r.details.redirectTo);
  notFound();
}

export async function generateMetadata({ params }: PageProps<"/blog/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = await loadPost(slug);
  const title = p.metaTitle || p.title;
  const description = p.metaDescription || p.excerpt || undefined;
  const url = siteUrl(`/blog/${p.slug}`);
  const image = p.ogImageUrl || p.coverUrl;
  return {
    title: { absolute: p.metaTitle ? p.metaTitle : `${p.title} | FITR8 Blog` },
    description,
    alternates: { canonical: p.canonicalUrl || url },
    robots: p.noindex ? { index: false, follow: true } : undefined,
    authors: p.author
      ? [{ name: p.author.name, url: siteUrl(`/blog/author/${p.author.slug}`) }]
      : undefined,
    keywords: p.tags.map((t) => t.name),
    openGraph: {
      type: "article",
      url,
      title,
      description,
      siteName: "FITR8",
      publishedTime: p.publishedAt ?? undefined,
      modifiedTime: p.updatedAt,
      authors: p.author ? [siteUrl(`/blog/author/${p.author.slug}`)] : undefined,
      section: p.category?.name,
      tags: p.tags.map((t) => t.name),
      images: image ? [{ url: image, alt: p.coverAlt ?? p.title }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function PostPage({ params }: PageProps<"/blog/[slug]">) {
  const { slug } = await params;
  const p = await loadPost(slug);
  const url = siteUrl(`/blog/${p.slug}`);
  const meta = [p.author?.name, formatPostDate(p.publishedAt), `${p.readingMinutes} min read`]
    .filter(Boolean)
    .join(" · ");

  const structured: Record<string, unknown>[] = [
    {
      "@context": "https://schema.org",
      "@type": "BlogPosting",
      headline: p.title,
      description: p.metaDescription || p.excerpt || undefined,
      image: p.ogImageUrl || p.coverUrl || undefined,
      datePublished: p.publishedAt ?? undefined,
      dateModified: p.updatedAt,
      wordCount: p.wordCount,
      articleSection: p.category?.name,
      keywords: p.tags.map((t) => t.name).join(", ") || undefined,
      mainEntityOfPage: { "@type": "WebPage", "@id": url },
      url,
      author: p.authorProfile
        ? {
            "@type": "Person",
            name: p.authorProfile.name,
            url: siteUrl(`/blog/author/${p.authorProfile.slug}`),
            sameAs: authorLinks(p.authorProfile).map((l) => l.href),
          }
        : { "@type": "Organization", name: "FITR8" },
      publisher: {
        "@type": "Organization",
        name: "FITR8",
        url: siteUrl("/"),
        logo: { "@type": "ImageObject", url: siteUrl("/icons/icon-512.png") },
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "Blog", item: siteUrl("/blog") },
        ...(p.category
          ? [
              {
                "@type": "ListItem",
                position: 2,
                name: p.category.name,
                item: siteUrl(`/blog/category/${p.category.slug}`),
              },
            ]
          : []),
        { "@type": "ListItem", position: p.category ? 3 : 2, name: p.title, item: url },
      ],
    },
  ];
  if (p.faq.length)
    structured.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: p.faq.map((f) => ({
        "@type": "Question",
        name: f.question,
        acceptedAnswer: { "@type": "Answer", text: f.answer },
      })),
    });

  return (
    <BlogShell
      eyebrow={
        <Crumbs
          items={[
            { href: "/blog", label: "Blog" },
            ...(p.category
              ? [{ href: `/blog/category/${p.category.slug}`, label: p.category.name }]
              : []),
          ]}
        />
      }
      title={p.title}
      intro={
        <>
          {p.excerpt && <p>{p.excerpt}</p>}
          <p className="mt-4 text-[15px] font-semibold text-white/70">{meta}</p>
        </>
      }
    >
      <JsonLd data={structured} />
      <Article post={{ ...p, meta }}>
        <ShareLinks url={url} title={p.title} />
        {p.authorProfile && <AuthorBox author={p.authorProfile} />}
      </Article>
      {p.related.length > 0 && (
        <section aria-labelledby="related" className="bg-fitr8-soft">
          <div className="mx-auto max-w-[1300px] px-4 py-14 sm:px-6 lg:px-10">
            <h2 id="related" className="text-[28px] font-semibold tracking-[-0.02em]">
              Keep reading
            </h2>
            <div className="mt-6">
              <PostGrid posts={p.related} />
            </div>
          </div>
        </section>
      )}
    </BlogShell>
  );
}
