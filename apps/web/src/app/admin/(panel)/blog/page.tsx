import Link from "next/link";
import type { BlogStatsDto } from "@fitr8/contracts";
import { PostTable } from "@/components/admin/post-table";
import { Card, PageHead } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";

export const metadata = { title: "Blog" };

export default async function AdminDashboard() {
  const me = await requireStaff();
  const stats = await blogServerApi<BlogStatsDto>("/stats");
  const c = stats.counts;
  const tiles = [
    { label: "Published", value: c.PUBLISHED, href: "/admin/blog/posts?status=PUBLISHED" },
    { label: "Scheduled", value: c.SCHEDULED, href: "/admin/blog/posts?status=SCHEDULED" },
    { label: "Drafts", value: c.DRAFT, href: "/admin/blog/posts?status=DRAFT" },
    ...(me.sections.blog.manageContent
      ? [
          { label: "Categories", value: c.categories, href: "/admin/blog/categories" },
          { label: "Tags", value: c.tags, href: "/admin/blog/tags" },
        ]
      : []),
    { label: "Images", value: c.media, href: "/admin/blog/media" },
  ];
  return (
    <>
      <PageHead
        title="Blog"
        lead={
          me.staff.role === "AUTHOR"
            ? "Your posts at a glance. An editor publishes them."
            : "The FITR8 blog at a glance."
        }
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {tiles.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            className="lift rounded-card border border-line bg-surface p-4"
          >
            <p className="text-[13px] font-semibold text-ink-3">{t.label}</p>
            <p className="mt-1 display text-[32px] tabular-nums">{t.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <h2 className="mb-3 display text-[19px]">Recently edited</h2>
          <PostTable posts={stats.recent} empty="No posts yet. Start one with New post." />
        </div>
        <Card>
          <h2 className="display text-[19px]">Coming up</h2>
          {stats.upcoming.length ? (
            <ul className="mt-3 divide-y divide-line">
              {stats.upcoming.map((p) => (
                <li key={p.id} className="py-2.5">
                  <Link
                    href={`/admin/blog/posts/${p.id}`}
                    className="font-semibold hover:text-brand"
                  >
                    {p.title}
                  </Link>
                  <p className="text-[13px] text-ink-3">
                    {p.publishedAt &&
                      new Intl.DateTimeFormat("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(p.publishedAt))}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-[14px] text-ink-2">
              Nothing scheduled. Pick a date in a post&rsquo;s Publish panel.
            </p>
          )}
        </Card>
      </div>
    </>
  );
}
