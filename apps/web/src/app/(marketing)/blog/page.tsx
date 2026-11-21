import type { Metadata } from "next";
import type { BlogCategoryDto, BlogPostPageDto } from "@fitr8/contracts";
import { apiUrl } from "@/lib/api-url";
import { blogGetOr } from "@/lib/server/blog";
import { siteUrl } from "@/lib/site-url";
import { BlogShell } from "./_components/blog-shell";
import { JsonLd } from "./_components/json-ld";
import { pageParam } from "./_components/page-param";
import { EmptyPosts, Pagination, PostCard, PostGrid } from "./_components/post-card";
import { TopicBar } from "./_components/topic-bar";

const EMPTY: BlogPostPageDto = { posts: [], page: 1, pages: 1, total: 0 };
const TITLE = "FITR8 Blog: food, training and fat loss, explained";
const DESCRIPTION =
  "Practical guides on Indian food, protein, calories, strength training and losing fat, written and checked by the FITR8 team.";

export async function generateMetadata({ searchParams }: PageProps<"/blog">): Promise<Metadata> {
  const page = pageParam((await searchParams).page);
  return {
    title: { absolute: page > 1 ? `${TITLE} (page ${page})` : TITLE },
    description: DESCRIPTION,
    alternates: {
      canonical: siteUrl(page > 1 ? `/blog?page=${page}` : "/blog"),
      types: { "application/rss+xml": apiUrl("/api/blog/rss.xml") },
    },
    openGraph: {
      type: "website",
      url: siteUrl("/blog"),
      title: TITLE,
      description: DESCRIPTION,
      siteName: "FITR8",
    },
    twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION },
  };
}

export default async function BlogIndex({ searchParams }: PageProps<"/blog">) {
  const page = pageParam((await searchParams).page);
  const [list, categories] = await Promise.all([
    blogGetOr<BlogPostPageDto>(`/posts?page=${page}`, EMPTY),
    blogGetOr<BlogCategoryDto[]>("/categories", []),
  ]);
  const [lead, ...rest] = list.posts;
  const showLead = page === 1 && lead;

  return (
    <BlogShell
      eyebrow="FITR8 Blog"
      title="Eat smarter, train better, see real progress."
      intro="Guides on Indian food, protein, calories and training, checked by the FITR8 team."
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Blog",
          name: "FITR8 Blog",
          url: siteUrl("/blog"),
          description: DESCRIPTION,
          publisher: { "@type": "Organization", name: "FITR8", url: siteUrl("/") },
        }}
      />
      <div className="mx-auto max-w-[1300px] px-4 py-10 sm:px-6 lg:px-10 lg:py-14">
        <TopicBar categories={categories} />
        <div className="mt-8">
          {!list.posts.length ? (
            <EmptyPosts>New posts are on the way. Check back soon.</EmptyPosts>
          ) : (
            <>
              {showLead && <PostCard post={lead} large />}
              <div className={showLead ? "mt-8" : undefined}>
                <PostGrid posts={showLead ? rest : list.posts} />
              </div>
              <Pagination page={list.page} pages={list.pages} base="/blog" />
            </>
          )}
        </div>
      </div>
    </BlogShell>
  );
}
