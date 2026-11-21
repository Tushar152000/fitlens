import Link from "next/link";
import type { BlogAdminPostRowDto } from "@fitr8/contracts";
import { Empty, formatWhen, StatusBadge } from "./ui";

/** Posts as rows: title + URL, status, author, category, date. */
export function PostTable({ posts, empty }: { posts: BlogAdminPostRowDto[]; empty: string }) {
  if (!posts.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      <table className="w-full text-left text-[14px]">
        <thead className="hidden border-b border-line bg-ground text-[12px] font-bold tracking-[0.04em] text-ink-3 uppercase md:table-header-group">
          <tr>
            <th className="px-4 py-3">Title</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Author</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3 text-right">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {posts.map((p) => (
            <tr
              key={p.id}
              className="relative flex flex-col gap-1 px-4 py-3 hover:bg-ground md:table-row"
            >
              <td className="md:px-4 md:py-3">
                <Link
                  href={`/admin/blog/posts/${p.id}`}
                  className="font-semibold text-ink after:absolute after:inset-0 hover:text-brand"
                >
                  {p.title || "Untitled"}
                  {p.featured && (
                    <span className="ml-2 text-[12px] font-bold text-brand">Featured</span>
                  )}
                </Link>
                <p className="text-[12px] text-ink-3">
                  /blog/{p.slug} · {p.wordCount} words
                </p>
              </td>
              <td className="md:px-4 md:py-3">
                <StatusBadge status={p.status} />
                {p.status === "SCHEDULED" && (
                  <p className="text-[12px] text-ink-3">{formatWhen(p.publishedAt)}</p>
                )}
              </td>
              <td className="text-ink-2 md:px-4 md:py-3">{p.author?.name ?? "—"}</td>
              <td className="text-ink-2 md:px-4 md:py-3">{p.category?.name ?? "—"}</td>
              <td className="text-[13px] text-ink-3 md:px-4 md:py-3 md:text-right">
                {formatWhen(p.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
