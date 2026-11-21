import { Search } from "lucide-react";
import Link from "next/link";
import type { BlogAdminPostPageDto } from "@fitr8/contracts";
import { PostTable } from "@/components/admin/post-table";
import { inputClass, PageHead, smallButton } from "@/components/admin/ui";
import { blogServerApi, requireStaff } from "@/lib/admin/server";
import { cn } from "@/lib/cn";

export const metadata = { title: "Posts" };

const TABS = [
  { key: undefined, label: "All" },
  { key: "DRAFT", label: "Drafts" },
  { key: "SCHEDULED", label: "Scheduled" },
  { key: "PUBLISHED", label: "Published" },
] as const;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function AdminPosts({ searchParams }: PageProps<"/admin/blog/posts">) {
  const me = await requireStaff();
  const sp = await searchParams;
  const status = TABS.find((t) => t.key === one(sp.status))?.key;
  const q = one(sp.q)?.slice(0, 100) ?? "";
  const page = Math.max(1, Number(one(sp.page)) || 1);
  const mine = one(sp.mine) === "1";

  const qs = new URLSearchParams({ page: String(page) });
  if (status) qs.set("status", status);
  if (q) qs.set("q", q);
  if (mine) qs.set("mine", "1");
  const data = await blogServerApi<BlogAdminPostPageDto>(`/posts?${qs}`);

  const href = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { status, q: q || undefined, mine: mine ? "1" : undefined, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `/admin/blog/posts?${s}` : "/admin/blog/posts";
  };
  const total = data.counts.DRAFT + data.counts.SCHEDULED + data.counts.PUBLISHED;

  return (
    <>
      <PageHead
        title="Posts"
        lead={me.staff.role === "AUTHOR" ? "Posts you have written." : undefined}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav className="flex gap-1 rounded-button bg-chip p-1" aria-label="Status">
          {TABS.map((t) => (
            <Link
              key={t.label}
              href={href({ status: t.key, page: undefined })}
              aria-current={status === t.key ? "page" : undefined}
              className={cn(
                "flex h-9 items-center gap-1.5 rounded-[12px] px-3 text-[14px] font-semibold",
                status === t.key ? "bg-surface text-ink shadow-seg" : "text-ink-2",
              )}
            >
              {t.label}
              <span className="text-[12px] text-ink-3 tabular-nums">
                {t.key ? data.counts[t.key] : total}
              </span>
            </Link>
          ))}
        </nav>
        {me.staff.role !== "AUTHOR" && (
          <Link
            href={href({ mine: mine ? undefined : "1", page: undefined })}
            className={smallButton}
          >
            {mine ? "Everyone's posts" : "Only mine"}
          </Link>
        )}
        <form className="relative ml-auto w-full sm:w-72" action="/admin/blog/posts">
          {status && <input type="hidden" name="status" value={status} />}
          {mine && <input type="hidden" name="mine" value="1" />}
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-3"
            aria-hidden
          />
          <input
            name="q"
            defaultValue={q}
            placeholder="Search title or URL"
            aria-label="Search posts"
            className={cn(inputClass, "h-10 pl-9")}
          />
        </form>
      </div>
      <PostTable posts={data.posts} empty={q ? `No posts match “${q}”.` : "No posts here yet."} />
      {data.pages > 1 && (
        <div className="mt-4 flex items-center justify-end gap-2 text-[14px]">
          {page > 1 && (
            <Link className={smallButton} href={href({ page: String(page - 1) })}>
              Previous
            </Link>
          )}
          <span className="text-ink-3">
            Page {data.page} of {data.pages}
          </span>
          {page < data.pages && (
            <Link className={smallButton} href={href({ page: String(page + 1) })}>
              Next
            </Link>
          )}
        </div>
      )}
    </>
  );
}
