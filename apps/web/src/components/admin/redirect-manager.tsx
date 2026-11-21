"use client";

import { Trash2 } from "lucide-react";
import { useState } from "react";
import type { BlogRedirectDto } from "@fitr8/contracts";
import { blogApi } from "@/lib/admin/api";
import { dangerButton, Empty, Field, formatWhen, inputClass, smallButton } from "./ui";

/** Old /blog URLs that send readers (and Google) somewhere else with a permanent redirect. */
export function RedirectManager({ initial }: { initial: BlogRedirectDto[] }) {
  const [list, setList] = useState(initial);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("/blog/");
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await blogApi<BlogRedirectDto>("/redirects", {
        method: "POST",
        json: { fromSlug: from.replace(/^\/?blog\//, "").trim(), toPath: to.trim() },
      });
      setList((l) => [r, ...l]);
      setFrom("");
      setTo("/blog/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add it.");
    }
  }

  async function remove(r: BlogRedirectDto) {
    if (!window.confirm(`Stop redirecting /blog/${r.fromSlug}?`)) return;
    await blogApi(`/redirects/${r.id}`, { method: "DELETE" });
    setList((l) => l.filter((x) => x.id !== r.id));
  }

  return (
    <>
      <form
        onSubmit={add}
        className="mb-6 grid gap-3 rounded-card border border-line bg-surface p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
      >
        <Field label="Old URL" htmlFor="rd-from" hint="The part after /blog/">
          <input
            id="rd-from"
            required
            className={inputClass}
            value={from}
            placeholder="old-post-name"
            onChange={(e) => setFrom(e.target.value.toLowerCase())}
          />
        </Field>
        <Field label="Send to" htmlFor="rd-to" hint="A path on the site or an https link">
          <input
            id="rd-to"
            required
            className={inputClass}
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </Field>
        <button type="submit" className={`${smallButton} h-12`}>
          Add redirect
        </button>
        {error && (
          <p role="alert" className="text-[14px] font-semibold text-caution-text md:col-span-3">
            {error}
          </p>
        )}
      </form>
      {list.length ? (
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {list.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[14px]">
              <div className="min-w-0 flex-1">
                <p className="font-semibold break-all">
                  /blog/{r.fromSlug} → {r.toPath}
                </p>
                <p className="text-[12px] text-ink-3">
                  {r.auto ? "Made when the post's URL changed" : "Added by hand"} ·{" "}
                  {formatWhen(r.createdAt)}
                </p>
              </div>
              <button
                type="button"
                className={dangerButton}
                onClick={() => remove(r)}
                aria-label={`Delete redirect from ${r.fromSlug}`}
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <Empty>No redirects. Changing a published post&rsquo;s URL adds one automatically.</Empty>
      )}
    </>
  );
}
