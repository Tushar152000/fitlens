"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { slugify } from "@fitr8/domain/blog";
import { blogApi } from "@/lib/admin/api";
import { Modal } from "./modal";
import { dangerButton, Empty, Field, inputClass, smallButton, textareaClass } from "./ui";
import { Button } from "@/components/ui";

interface Item {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  metaTitle?: string | null;
  metaDescription?: string | null;
  postCount: number;
}

type Draft = {
  id?: string;
  name: string;
  slug: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
};

/** Categories or tags: list with post counts, add / edit / delete in a dialog. */
export function TaxonomyManager({
  kind,
  initial,
}: {
  kind: "categories" | "tags";
  initial: Item[];
}) {
  const [items, setItems] = useState(initial);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const one = kind === "categories" ? "category" : "tag";
  const withSeo = kind === "categories";

  const open = (i?: Item) => {
    setError(null);
    setDraft({
      id: i?.id,
      name: i?.name ?? "",
      slug: i?.slug ?? "",
      description: i?.description ?? "",
      metaTitle: i?.metaTitle ?? "",
      metaDescription: i?.metaDescription ?? "",
    });
  };

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const json = {
        name: draft.name,
        slug: draft.slug || undefined,
        description: draft.description,
        ...(withSeo ? { metaTitle: draft.metaTitle, metaDescription: draft.metaDescription } : {}),
      };
      const saved = await blogApi<Item>(draft.id ? `/${kind}/${draft.id}` : `/${kind}`, {
        method: draft.id ? "PUT" : "POST",
        json,
      });
      setItems((list) =>
        [...list.filter((x) => x.id !== saved.id), saved].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setDraft(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  }

  async function remove(i: Item) {
    const note = i.postCount ? ` ${i.postCount} post(s) will lose this ${one}.` : "";
    if (!window.confirm(`Delete “${i.name}”?${note}`)) return;
    try {
      await blogApi(`/${kind}/${i.id}`, { method: "DELETE" });
      setItems((list) => list.filter((x) => x.id !== i.id));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Couldn't delete.");
    }
  }

  return (
    <>
      <div className="mb-4">
        <button type="button" className={smallButton} onClick={() => open()}>
          <Plus className="size-4" aria-hidden />
          New {one}
        </button>
      </div>
      {items.length ? (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {items.map((i) => (
            <li key={i.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-semibold">{i.name}</p>
                <p className="truncate text-[12px] text-ink-3">
                  /blog/{kind === "categories" ? "category" : "tag"}/{i.slug} · {i.postCount} post
                  {i.postCount === 1 ? "" : "s"}
                </p>
              </div>
              <button type="button" className={smallButton} onClick={() => open(i)}>
                <Pencil className="size-4" aria-hidden />
                Edit
              </button>
              <button
                type="button"
                className={dangerButton}
                onClick={() => remove(i)}
                aria-label={`Delete ${i.name}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No {kind} yet.</Empty>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={() => setDraft(null)}
        title={draft?.id ? `Edit ${one}` : `New ${one}`}
      >
        {draft && (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <Field label="Name" htmlFor="tx-name">
              <input
                id="tx-name"
                required
                maxLength={80}
                className={inputClass}
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              />
            </Field>
            <Field
              label="URL"
              htmlFor="tx-slug"
              hint={`Leave empty to use “${slugify(draft.name) || "…"}”.`}
            >
              <input
                id="tx-slug"
                className={inputClass}
                value={draft.slug}
                placeholder={slugify(draft.name)}
                onChange={(e) =>
                  setDraft({ ...draft, slug: e.target.value.toLowerCase().replace(/\s+/g, "-") })
                }
              />
            </Field>
            <Field
              label="Description"
              htmlFor="tx-desc"
              hint="Shown at the top of its page; helps it rank."
            >
              <textarea
                id="tx-desc"
                rows={3}
                maxLength={500}
                className={textareaClass}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </Field>
            {withSeo && (
              <>
                <Field label="Search title" htmlFor="tx-mt">
                  <input
                    id="tx-mt"
                    maxLength={120}
                    className={inputClass}
                    value={draft.metaTitle}
                    onChange={(e) => setDraft({ ...draft, metaTitle: e.target.value })}
                  />
                </Field>
                <Field label="Meta description" htmlFor="tx-md">
                  <textarea
                    id="tx-md"
                    rows={2}
                    maxLength={320}
                    className={textareaClass}
                    value={draft.metaDescription}
                    onChange={(e) => setDraft({ ...draft, metaDescription: e.target.value })}
                  />
                </Field>
              </>
            )}
            {error && (
              <p role="alert" className="text-[14px] font-semibold text-caution-text">
                {error}
              </p>
            )}
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save"}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}
