"use client";

import { ArrowLeft, ExternalLink, Eye, Plus, Star, Trash2, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type {
  BlogAdminPostDto,
  BlogCategoryDto,
  BlogFaqItem,
  BlogMediaDto,
  AdminMeDto,
  BlogAuthorOptionDto,
  BlogPostUpdateInput,
  BlogTagDto,
} from "@fitr8/contracts";
import { isValidSlug, seoChecks, slugify } from "@fitr8/domain/blog";
import { Button } from "@/components/ui";
import { blogApi, ApiError } from "@/lib/admin/api";
import { analyseHtml, htmlText } from "@/lib/admin/analyse";
import { cn } from "@/lib/cn";
import { SITE_URL } from "@/lib/site-url";
import { ImagePicker } from "../image-picker";
import {
  dangerButton,
  Field,
  formatWhen,
  inputClass,
  labelClass,
  smallButton,
  StatusBadge,
  textareaClass,
} from "../ui";
import { Revisions } from "./revisions";
import { RichEditor } from "./rich-editor";
import { SeoPanel, type SeoFields } from "./seo-panel";

const AUTOSAVE_MS = 2000;

interface Fields extends SeoFields {
  title: string;
  slug: string;
  excerpt: string;
  featured: boolean;
  cover: BlogMediaDto | null;
  coverAlt: string;
  categoryId: string | null;
  tagIds: string[];
  authorId: string | null;
  faq: BlogFaqItem[];
}

const fieldsOf = (p: BlogAdminPostDto): Fields => ({
  title: p.title,
  slug: p.slug,
  excerpt: p.excerpt ?? "",
  featured: p.featured,
  cover: p.cover,
  coverAlt: p.coverAlt ?? "",
  categoryId: p.categoryId,
  tagIds: p.tagIds,
  authorId: p.authorId,
  faq: p.faq,
  metaTitle: p.metaTitle ?? "",
  metaDescription: p.metaDescription ?? "",
  focusKeyword: p.focusKeyword ?? "",
  canonicalUrl: p.canonicalUrl ?? "",
  noindex: p.noindex,
  ogImage: p.ogImage,
});

type SaveState = "saved" | "dirty" | "saving" | "error" | "conflict";

/** The post editor: body on the left, publishing / settings / SEO on the right. Autosaves. */
export function PostEditor({
  initial,
  me,
  categories,
  tags: initialTags,
  members,
}: {
  initial: BlogAdminPostDto;
  me: AdminMeDto;
  categories: BlogCategoryDto[];
  tags: BlogTagDto[];
  members: BlogAuthorOptionDto[];
}) {
  const router = useRouter();
  const [post, setPost] = useState(initial);
  const [f, setF] = useState<Fields>(() => fieldsOf(initial));
  const [html, setHtml] = useState(initial.contentHtml);
  const [tags, setTags] = useState(initialTags);
  const [state, setState] = useState<SaveState>("saved");
  const [error, setError] = useState<string | null>(null);
  const [editorKey, setEditorKey] = useState(0);
  const [picking, setPicking] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [busy, setBusy] = useState(false);

  const content = useRef<{ json: Record<string, unknown>; html: string } | null>(null);
  const fieldsDirty = useRef(false);
  const base = useRef(initial.updatedAt);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef<Promise<boolean> | null>(null);
  // After a 409 nothing autosaves until the page is reloaded (that would overwrite someone's work).
  const conflict = useRef(false);
  const latest = useRef(f);
  useEffect(() => {
    latest.current = f;
  }, [f]);
  const slugTouched = useRef(
    initial.status !== "DRAFT" ||
      (initial.slug !== slugify(initial.title) && !/^untitled-post/.test(initial.slug)),
  );

  const editable = post.can.edit;

  // ── Saving ─────────────────────────────────────────────────────────

  const save = useCallback(
    async (opts: { snapshot?: boolean } = {}): Promise<boolean> => {
      if (timer.current) clearTimeout(timer.current);
      if (inFlight.current) await inFlight.current;
      const body = content.current;
      if (!fieldsDirty.current && !body && !opts.snapshot) return true;

      const v = latest.current;
      const payload: BlogPostUpdateInput = {
        title: v.title.trim() || "Untitled post",
        excerpt: v.excerpt,
        coverId: v.cover?.id ?? null,
        coverAlt: v.coverAlt,
        categoryId: v.categoryId,
        tagIds: v.tagIds,
        metaTitle: v.metaTitle,
        metaDescription: v.metaDescription,
        focusKeyword: v.focusKeyword,
        canonicalUrl: v.canonicalUrl.trim() || null,
        noindex: v.noindex,
        ogImageId: v.ogImage?.id ?? null,
        // Half-written questions wait until both parts are filled in.
        faq: v.faq.filter((q) => q.question.trim() && q.answer.trim()),
        baseUpdatedAt: base.current,
        snapshot: opts.snapshot,
      };
      if (isValidSlug(v.slug)) payload.slug = v.slug;
      if (me.sections.blog.publish) payload.featured = v.featured;
      if (me.sections.blog.assignAuthor && v.authorId) payload.authorId = v.authorId;
      if (body) {
        payload.contentJson = body.json;
        payload.contentHtml = body.html;
      }

      fieldsDirty.current = false;
      content.current = null;
      setState("saving");
      const run = (async () => {
        try {
          const saved = await blogApi<BlogAdminPostDto>(`/posts/${post.id}`, {
            method: "PUT",
            json: payload,
          });
          base.current = saved.updatedAt;
          setPost(saved);
          setError(null);
          // Edits made while this request was in flight are still pending.
          setState(fieldsDirty.current || content.current ? "dirty" : "saved");
          return true;
        } catch (err) {
          // Put the unsaved work back so the next attempt sends it.
          fieldsDirty.current = true;
          if (body && !content.current) content.current = body;
          if (err instanceof ApiError && err.status === 409 && /Someone saved/.test(err.message)) {
            conflict.current = true;
            setState("conflict");
          } else {
            setState("error");
          }
          setError(err instanceof Error ? err.message : "Couldn't save.");
          return false;
        }
      })();
      inFlight.current = run;
      const ok = await run;
      inFlight.current = null;
      return ok;
    },
    [post.id, me.sections.blog.publish, me.sections.blog.assignAuthor],
  );

  const schedule = useCallback(() => {
    if (conflict.current) return;
    setState("dirty");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), AUTOSAVE_MS);
  }, [save]);

  const patch = useCallback(
    (p: Partial<Fields>) => {
      setF((prev) => {
        const next = { ...prev, ...p };
        if (p.title !== undefined && !slugTouched.current)
          next.slug = slugify(p.title) || prev.slug;
        return next;
      });
      fieldsDirty.current = true;
      schedule();
    },
    [schedule],
  );

  // Ctrl/⌘ S: save now as a named version. Warn before leaving with unsaved work.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (editable) void save({ snapshot: true });
      }
    };
    const onLeave = (e: BeforeUnloadEvent) => {
      if (fieldsDirty.current || content.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("beforeunload", onLeave);
    };
  }, [save, editable]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // ── Publishing ─────────────────────────────────────────────────────

  async function act(path: string, json?: unknown) {
    setBusy(true);
    try {
      if (editable && !(await save())) return;
      const next = await blogApi<BlogAdminPostDto>(`/posts/${post.id}/${path}`, {
        method: "POST",
        json: json ?? {},
      });
      base.current = next.updatedAt;
      setPost(next);
      setError(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Delete “${f.title}”? This can't be undone.`)) return;
    setBusy(true);
    try {
      await blogApi(`/posts/${post.id}`, { method: "DELETE" });
      fieldsDirty.current = false;
      content.current = null;
      router.push("/admin/blog/posts");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
      setBusy(false);
    }
  }

  async function preview() {
    if (editable) await save();
    window.open(`/admin/blog/posts/${post.id}/preview`, "_blank", "noopener");
  }

  function restored(next: BlogAdminPostDto) {
    base.current = next.updatedAt;
    setPost(next);
    setF(fieldsOf(next));
    setHtml(next.contentHtml);
    content.current = null;
    fieldsDirty.current = false;
    setState("saved");
    setEditorKey((k) => k + 1);
  }

  async function addTag() {
    const name = window.prompt("New tag name:");
    if (!name?.trim()) return;
    try {
      const tag = await blogApi<BlogTagDto>("/tags", {
        method: "POST",
        json: { name: name.trim() },
      });
      setTags((t) => [...t, tag].sort((a, b) => a.name.localeCompare(b.name)));
      patch({ tagIds: [...f.tagIds, tag.id] });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't add the tag.");
    }
  }

  // ── SEO checklist (live) ───────────────────────────────────────────

  const deferredHtml = useDeferredValue(html);
  const seo = useMemo(() => {
    const stats = analyseHtml(deferredHtml, [new URL(SITE_URL).hostname]);
    return seoChecks({
      title: f.title,
      metaTitle: f.metaTitle,
      metaDescription: f.metaDescription,
      excerpt: f.excerpt,
      slug: f.slug,
      text: htmlText(deferredHtml),
      focusKeyword: f.focusKeyword,
      hasCover: Boolean(f.cover),
      ...stats,
      imagesWithoutAlt: stats.imagesWithoutAlt + (f.cover && !f.coverAlt.trim() ? 1 : 0),
    });
  }, [deferredHtml, f]);

  const words = useMemo(
    () => htmlText(deferredHtml).split(/\s+/).filter(Boolean).length,
    [deferredHtml],
  );
  const status = post.status;
  const live = status === "PUBLISHED";
  const stateText: Record<SaveState, string> = {
    saved: `Saved ${formatWhen(post.updatedAt)}`,
    dirty: "Unsaved changes",
    saving: "Saving…",
    error: "Couldn't save",
    conflict: "Changed elsewhere",
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Link href="/admin/blog/posts" className={smallButton}>
            <ArrowLeft className="size-4" aria-hidden />
            Posts
          </Link>
          <StatusBadge status={status} />
          <span
            role="status"
            className={cn(
              "text-[13px] font-semibold",
              state === "error" || state === "conflict" ? "text-caution-text" : "text-ink-3",
            )}
          >
            {stateText[state]}
          </span>
          <span className="ml-auto text-[13px] text-ink-3 tabular-nums">
            {words} words · {Math.max(words ? 1 : 0, Math.round(words / 220))} min read
          </span>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center gap-3 rounded-input bg-caution-soft px-4 py-3 text-[14px] font-semibold text-caution-text"
          >
            {error}
            {state === "conflict" && (
              <button
                type="button"
                className={smallButton}
                onClick={() => window.location.reload()}
              >
                Reload
              </button>
            )}
          </div>
        )}
        {!editable && (
          <p className="mb-4 rounded-input bg-water-soft px-4 py-3 text-[14px] font-semibold text-water">
            This post is {status === "PUBLISHED" ? "published" : "scheduled"}. An editor can make
            changes.
          </p>
        )}

        <label htmlFor="post-title" className="sr-only">
          Title
        </label>
        <textarea
          id="post-title"
          rows={1}
          value={f.title}
          disabled={!editable}
          maxLength={200}
          placeholder="Post title"
          onChange={(e) => patch({ title: e.target.value.replace(/\n/g, " ") })}
          className="mb-4 field-sizing-content w-full resize-none bg-transparent font-display text-[34px] leading-[1.15] font-bold tracking-[-0.02em] outline-none placeholder:text-ink-3 sm:text-[40px]"
        />

        <RichEditor
          key={editorKey}
          initial={
            hasBlocks(post.contentJson) || !post.contentHtml ? post.contentJson : post.contentHtml
          }
          editable={editable}
          onChange={(c) => {
            content.current = c;
            setHtml(c.html);
            schedule();
          }}
        />
      </div>

      <aside className="flex flex-col gap-4 xl:sticky xl:top-6 xl:max-h-[calc(100dvh-48px)] xl:overflow-y-auto xl:pb-6">
        <Panel title="Publish">
          {post.publishedAt && status !== "DRAFT" && (
            <p className="text-[13px] text-ink-2">
              {status === "SCHEDULED" ? "Goes live" : "Published"} {formatWhen(post.publishedAt)}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button type="button" className={smallButton} onClick={preview}>
                <Eye className="size-4" aria-hidden />
                Preview
              </button>
              {live ? (
                <a
                  className={smallButton}
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noopener"
                >
                  <ExternalLink className="size-4" aria-hidden />
                  View live
                </a>
              ) : (
                <button
                  type="button"
                  className={smallButton}
                  disabled={!editable || state === "saving"}
                  onClick={() => save({ snapshot: true })}
                >
                  Save version
                </button>
              )}
            </div>
            {me.sections.blog.publish ? (
              <>
                {status === "DRAFT" ? (
                  <Button onClick={() => act("publish")} disabled={busy} className="h-12">
                    Publish now
                  </Button>
                ) : (
                  <Button
                    onClick={() => save({ snapshot: true })}
                    disabled={busy || state === "saving"}
                    className="h-12"
                  >
                    {state === "dirty" ? "Update" : "Save changes"}
                  </Button>
                )}
                <div className="mt-1">
                  <label htmlFor="schedule-at" className={labelClass}>
                    {status === "SCHEDULED" ? "Move the date" : "Or schedule"}
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="schedule-at"
                      type="datetime-local"
                      className={cn(inputClass, "h-10")}
                      value={scheduleAt}
                      onChange={(e) => setScheduleAt(e.target.value)}
                    />
                    <button
                      type="button"
                      className={smallButton}
                      disabled={!scheduleAt || busy}
                      onClick={() =>
                        act("publish", { publishAt: new Date(scheduleAt).toISOString() })
                      }
                    >
                      Schedule
                    </button>
                  </div>
                </div>
                {status !== "DRAFT" && (
                  <button
                    type="button"
                    className={smallButton}
                    disabled={busy}
                    onClick={() => act("unpublish")}
                  >
                    {status === "SCHEDULED" ? "Cancel schedule (back to draft)" : "Unpublish"}
                  </button>
                )}
              </>
            ) : (
              <p className="text-[13px] text-ink-2">
                When it&rsquo;s ready, ask an editor to publish it. Your work saves by itself.
              </p>
            )}
          </div>
        </Panel>

        <Panel title="URL and excerpt">
          <Field
            label="URL"
            htmlFor="post-slug"
            hint={
              isValidSlug(f.slug) ? (
                <span className="break-all">
                  {SITE_URL.replace(/^https?:\/\//, "")}/blog/{f.slug}
                  {live && f.slug !== initial.slug && " · the old URL will redirect here"}
                </span>
              ) : (
                <span className="text-caution-text">Lower-case words and hyphens only.</span>
              )
            }
          >
            <input
              id="post-slug"
              className={inputClass}
              value={f.slug}
              disabled={!editable}
              onChange={(e) => {
                slugTouched.current = true;
                patch({ slug: e.target.value.toLowerCase().replace(/\s+/g, "-") });
              }}
            />
          </Field>
          <Field
            label="Excerpt"
            htmlFor="post-excerpt"
            hint={`${f.excerpt.length} / 300 · shown on cards and under the title`}
          >
            <textarea
              id="post-excerpt"
              rows={3}
              maxLength={300}
              className={textareaClass}
              value={f.excerpt}
              disabled={!editable}
              onChange={(e) => patch({ excerpt: e.target.value })}
            />
          </Field>
        </Panel>

        <Panel title="Cover image">
          {f.cover ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- library image */}
              <img
                src={f.cover.url}
                alt=""
                className="aspect-[16/9] w-full rounded-input object-cover"
              />
              <Field
                label="Alt text"
                htmlFor="cover-alt"
                hint="Describe the photo for screen readers and Google."
              >
                <input
                  id="cover-alt"
                  className={inputClass}
                  value={f.coverAlt}
                  maxLength={200}
                  disabled={!editable}
                  onChange={(e) => patch({ coverAlt: e.target.value })}
                />
              </Field>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={smallButton}
                  disabled={!editable}
                  onClick={() => setPicking(true)}
                >
                  Change
                </button>
                <button
                  type="button"
                  className={dangerButton}
                  disabled={!editable}
                  onClick={() => patch({ cover: null })}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              disabled={!editable}
              onClick={() => setPicking(true)}
              className="grid aspect-[16/9] w-full place-items-center rounded-input border border-dashed border-line-strong text-[14px] font-semibold text-brand hover:bg-ground"
            >
              Add a cover image
            </button>
          )}
        </Panel>

        <Panel title="Organise">
          <Field label="Category" htmlFor="post-category">
            <select
              id="post-category"
              className={inputClass}
              value={f.categoryId ?? ""}
              disabled={!editable}
              onChange={(e) => patch({ categoryId: e.target.value || null })}
            >
              <option value="">No category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <p className={labelClass}>Tags</p>
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => {
                const on = f.tagIds.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!editable}
                    onClick={() =>
                      patch({
                        tagIds: on ? f.tagIds.filter((x) => x !== t.id) : [...f.tagIds, t.id],
                      })
                    }
                    className={cn(
                      "flex h-8 items-center rounded-full px-3 text-[13px] font-semibold",
                      on ? "bg-ink text-white" : "bg-chip text-ink-2 hover:bg-sunken",
                    )}
                  >
                    {t.name}
                  </button>
                );
              })}
              {me.sections.blog.manageContent && editable && (
                <button
                  type="button"
                  onClick={addTag}
                  className="flex h-8 items-center gap-1 rounded-full border border-dashed border-dash px-3 text-[13px] font-semibold text-brand"
                >
                  <Plus className="size-3.5" aria-hidden />
                  New tag
                </button>
              )}
              {!tags.length && !me.sections.blog.manageContent && (
                <p className="text-[13px] text-ink-3">No tags yet.</p>
              )}
            </div>
          </div>
          {me.sections.blog.assignAuthor && (
            <Field label="Author" htmlFor="post-author">
              <select
                id="post-author"
                className={inputClass}
                value={f.authorId ?? ""}
                disabled={!editable}
                onChange={(e) => patch({ authorId: e.target.value || null })}
              >
                {!f.authorId && <option value="">No author</option>}
                {members.map((m) => (
                  <option key={m.staffId} value={m.staffId}>
                    {m.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {me.sections.blog.publish && (
            <label className="flex items-center gap-3 text-[14px] font-semibold">
              <input
                type="checkbox"
                className="size-4 accent-brand"
                checked={f.featured}
                disabled={!editable}
                onChange={(e) => patch({ featured: e.target.checked })}
              />
              <Star className="size-4 text-brand" aria-hidden />
              Featured post
            </label>
          )}
        </Panel>

        <Panel title="Search and social">
          <SeoPanel
            value={f}
            onChange={patch}
            title={f.title}
            excerpt={f.excerpt}
            slug={f.slug}
            coverUrl={f.cover?.url ?? null}
            checks={seo.checks}
            score={seo.score}
            disabled={!editable}
          />
        </Panel>

        <Panel title="FAQ">
          <p className="text-[13px] text-ink-2">
            Shown under the post and marked up for Google&rsquo;s FAQ results.
          </p>
          {f.faq.map((q, i) => (
            <div key={i} className="flex flex-col gap-2 rounded-input border border-line p-3">
              <div className="flex items-start gap-2">
                <input
                  aria-label={`Question ${i + 1}`}
                  placeholder="Question"
                  className={cn(inputClass, "h-10")}
                  value={q.question}
                  maxLength={300}
                  disabled={!editable}
                  onChange={(e) =>
                    patch({
                      faq: f.faq.map((x, j) => (j === i ? { ...x, question: e.target.value } : x)),
                    })
                  }
                />
                <button
                  type="button"
                  aria-label={`Remove question ${i + 1}`}
                  disabled={!editable}
                  className="grid size-10 shrink-0 place-items-center rounded-full text-ink-3 hover:bg-sunken"
                  onClick={() => patch({ faq: f.faq.filter((_, j) => j !== i) })}
                >
                  <X className="size-4" aria-hidden />
                </button>
              </div>
              <textarea
                aria-label={`Answer ${i + 1}`}
                placeholder="Answer"
                rows={3}
                className={textareaClass}
                value={q.answer}
                maxLength={3000}
                disabled={!editable}
                onChange={(e) =>
                  patch({
                    faq: f.faq.map((x, j) => (j === i ? { ...x, answer: e.target.value } : x)),
                  })
                }
              />
            </div>
          ))}
          {editable && f.faq.length < 20 && (
            <button
              type="button"
              className={smallButton}
              onClick={() => patch({ faq: [...f.faq, { question: "", answer: "" }] })}
            >
              <Plus className="size-4" aria-hidden />
              Add a question
            </button>
          )}
        </Panel>

        <Panel title="Versions">
          <Revisions
            postId={post.id}
            canRestore={editable}
            onRestored={restored}
            refreshKey={post.updatedAt}
          />
        </Panel>

        {post.can.delete && (
          <button
            type="button"
            className={cn(dangerButton, "self-start")}
            disabled={busy}
            onClick={remove}
          >
            <Trash2 className="size-4" aria-hidden />
            Delete post
          </button>
        )}
      </aside>

      <ImagePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(m) => patch({ cover: m, coverAlt: f.coverAlt || m.alt || "" })}
        title="Cover image"
      />
    </div>
  );
}

/** A Tiptap document with real content. Posts created or imported as HTML only have an empty one. */
function hasBlocks(doc: Record<string, unknown>) {
  const content = doc.content;
  return (
    Array.isArray(content) &&
    content.some(
      (n) =>
        (n as { type?: string; content?: unknown[] }).content?.length ||
        (n as { type?: string }).type !== "paragraph",
    )
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-surface p-4">
      <h2 className="display text-[16px]">{title}</h2>
      {children}
    </section>
  );
}
