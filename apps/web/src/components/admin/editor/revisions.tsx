"use client";

import { History, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import type { BlogAdminPostDto, BlogRevisionDetailDto, BlogRevisionDto } from "@fitr8/contracts";
import { blogApi } from "@/lib/admin/api";
import { Modal } from "../modal";
import { formatWhen, smallButton } from "../ui";

const REASON: Record<string, string> = {
  autosave: "Autosave",
  manual: "Saved version",
  publish: "Published",
  schedule: "Scheduled",
  "before restore": "Before a restore",
};

/** Saved versions of the post; preview one and put it back. */
export function Revisions({
  postId,
  canRestore,
  onRestored,
  refreshKey,
}: {
  postId: string;
  canRestore: boolean;
  onRestored: (post: BlogAdminPostDto) => void;
  refreshKey: string;
}) {
  const [list, setList] = useState<BlogRevisionDto[] | null>(null);
  const [open, setOpen] = useState<BlogRevisionDetailDto | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    blogApi<BlogRevisionDto[]>(`/posts/${postId}/revisions`)
      .then((r) => live && setList(r))
      .catch(() => live && setList([]));
    return () => {
      live = false;
    };
  }, [postId, refreshKey]);

  async function show(id: string) {
    setOpen(await blogApi<BlogRevisionDetailDto>(`/posts/${postId}/revisions/${id}`));
  }

  async function restore() {
    if (
      !open ||
      !window.confirm(
        "Replace the current words with this version? The current version is kept as a revision.",
      )
    )
      return;
    setBusy(true);
    try {
      onRestored(
        await blogApi<BlogAdminPostDto>(`/posts/${postId}/revisions/${open.id}/restore`, {
          method: "POST",
        }),
      );
      setOpen(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't restore.");
    } finally {
      setBusy(false);
    }
  }

  if (!list) return <p className="text-[13px] text-ink-3">Loading…</p>;
  if (!list.length)
    return (
      <p className="flex items-start gap-2 text-[13px] text-ink-2">
        <History className="size-4 shrink-0" aria-hidden />
        Versions are saved every 10 minutes while you write, and whenever you publish or press
        Ctrl/⌘ S.
      </p>
    );
  return (
    <>
      <ul className="flex max-h-72 flex-col divide-y divide-line overflow-y-auto">
        {list.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => show(r.id)}
              className="w-full py-2 text-left hover:text-brand"
            >
              <span className="block text-[14px] font-semibold">{formatWhen(r.createdAt)}</span>
              <span className="block text-[12px] text-ink-3">
                {REASON[r.reason] ?? r.reason}
                {r.member && ` · ${r.member.name}`}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open ? formatWhen(open.createdAt) : "Version"}
        wide
      >
        {open && (
          <>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-[14px] text-ink-2">{REASON[open.reason] ?? open.reason}</p>
              {canRestore && (
                <button type="button" className={smallButton} disabled={busy} onClick={restore}>
                  <RotateCcw className="size-4" aria-hidden />
                  Restore this version
                </button>
              )}
            </div>
            <h1 className="text-[30px] leading-tight font-semibold">{open.title}</h1>
            <div
              className="blog-prose mt-4"
              dangerouslySetInnerHTML={{ __html: open.contentHtml }}
            />
          </>
        )}
      </Modal>
    </>
  );
}
