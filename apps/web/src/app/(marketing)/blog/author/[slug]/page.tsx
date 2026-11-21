import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { BlogAuthorDto, BlogPostPageDto } from "@fitr8/contracts";
import { blogGet, blogGetOr } from "@/lib/server/blog";
import { siteUrl } from "@/lib/site-url";
import { BlogShell, Crumbs } from "../../_components/blog-shell";
import { JsonLd } from "../../_components/json-ld";
import { pageParam } from "../../_components/page-param";
import { EmptyPosts, Pagination, PostGrid } from "../../_components/post-card";
import { authorLinks } from "../../_components/author-box";

export async function generateMetadata({
  params,
}: PageProps<"/blog/author/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const r = await blogGet<BlogAuthorDto>(`/authors/${encodeURIComponent(slug)}`);
  if (!r.ok) return { title: "Author not found | FITR8 Blog", robots: { index: false } };
  const title = `${r.data.name}, FITR8 Blog author`;
  const description = r.data.bio || `Articles by ${r.data.name} on the FITR8 Blog.`;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: siteUrl(`/blog/author/${r.data.slug}`) },
    openGraph: {
      type: "profile",
      url: siteUrl(`/blog/author/${r.data.slug}`),
      title,
      description,
      images: r.data.avatarUrl ? [r.data.avatarUrl] : undefined,
    },
  };
}

export default async function AuthorPage({
  params,
  searchParams,
}: PageProps<"/blog/author/[slug]">) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const page = pageParam(sp.page);
  const [author, list] = await Promise.all([
    blogGet<BlogAuthorDto>(`/authors/${encodeURIComponent(slug)}`),
    blogGetOr<BlogPostPageDto>(`/posts?author=${encodeURIComponent(slug)}&page=${page}`, {
      posts: [],
      page,
      pages: 1,
      total: 0,
    }),
  ]);
  if (!author.ok) notFound();
  const a = author.data;
  return (
    <BlogShell
      eyebrow={<Crumbs items={[{ href: "/blog", label: "Blog" }, { label: "Author" }]} />}
      title={a.name}
      intro={
        <div className="flex items-start gap-4">
          {a.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- served by the API
            <img
              src={a.avatarUrl}
              alt=""
              className="size-16 shrink-0 rounded-full object-cover ring-2 ring-white/40"
            />
          )}
          <div>
            {a.bio && <p>{a.bio}</p>}
            <p className="mt-2 flex flex-wrap gap-3 text-[15px] font-semibold">
              {authorLinks(a).map((l) => (
                <a
                  key={l.href}
                  href={l.href}
                  rel="me noopener"
                  target="_blank"
                  className="underline-offset-4 hover:underline"
                >
                  {l.label}
                </a>
              ))}
            </p>
          </div>
        </div>
      }
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ProfilePage",
          mainEntity: {
            "@type": "Person",
            name: a.name,
            description: a.bio ?? undefined,
            image: a.avatarUrl ?? undefined,
            url: siteUrl(`/blog/author/${a.slug}`),
            sameAs: authorLinks(a).map((l) => l.href),
          },
        }}
      />
      <div className="mx-auto max-w-[1300px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        {list.posts.length ? (
          <PostGrid posts={list.posts} />
        ) : (
          <EmptyPosts>No posts yet.</EmptyPosts>
        )}
        <Pagination page={list.page} pages={list.pages} base={`/blog/author/${a.slug}`} />
      </div>
    </BlogShell>
  );
}
