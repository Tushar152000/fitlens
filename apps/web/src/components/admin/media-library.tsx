"use client";

import { Copy, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import type { BlogMediaDto } from "@fitr8/contracts";
import { blogApi, BLOG_IMAGE_ACCEPT, uploadBlogImage } from "@/lib/admin/api";
import { cn } from "@/lib/cn";
import { dangerButton, Empty, inputClass, smallButton } from "./ui";

interface Page {
  media: BlogMediaDto[];
  page: number;
  pages: number;
  total: number;
}

/** Every blog image: upload (several at once), edit alt text, copy the URL, delete. */
export function MediaLibrary({ initial }: { initial: Page }) {
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError(null);
    const added: BlogMediaDto[] = [];
    for (const file of Array.from(files)) {
      try {
        added.push(await uploadBlogImage(file));
      } catch (err) {
        setError(`${file.name}: ${err instanceof Error ? err.message : "upload failed"}`);
      }
    }
    setData((d) => ({ ...d, media: [...added, ...d.media], total: d.total + added.length }));
    setBusy(false);
    if (input.current) input.current.value = "";
  }

  async function setAlt(m: BlogMediaDto, alt: string) {
    if ((m.alt ?? "") === alt) return;
    try {
      const saved = await blogApi<BlogMediaDto>(`/media/${m.id}`, {
        method: "PATCH",
        json: { alt },
      });
      setData((d) => ({ ...d, media: d.media.map((x) => (x.id === m.id ? saved : x)) }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the alt text.");
    }
  }

  async function remove(m: BlogMediaDto) {
    if (
      !window.confirm(
        "Delete this image? Posts using it as a cover lose it, and copies inside posts break.",
      )
    )
      return;
    try {
      await blogApi(`/media/${m.id}`, { method: "DELETE" });
      setData((d) => ({ ...d, media: d.media.filter((x) => x.id !== m.id), total: d.total - 1 }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete.");
    }
  }

  async function more() {
    const next = await blogApi<Page>(`/media?page=${data.page + 1}`);
    setData((d) => ({ ...next, media: [...d.media, ...next.media] }));
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={smallButton}
          disabled={busy}
          onClick={() => input.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {busy ? "Uploading…" : "Upload images"}
        </button>
        <input
          ref={input}
          type="file"
          multiple
          accept={BLOG_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => upload(e.target.files)}
        />
        <p className="text-[13px] text-ink-3">{data.total} images · up to 10 MB each</p>
      </div>
      {error && (
        <p
          role="alert"
          className="mb-4 rounded-input bg-caution-soft px-4 py-3 text-[14px] font-semibold text-caution-text"
        >
          {error}
        </p>
      )}
      {data.media.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {data.media.map((m) => (
            <figure
              key={m.id}
              className="overflow-hidden rounded-card border border-line bg-surface"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- library image */}
              <img
                src={m.url}
                alt={m.alt ?? ""}
                loading="lazy"
                className="aspect-[4/3] w-full bg-sunken object-cover"
              />
              <figcaption className="flex flex-col gap-2 p-3">
                <input
                  aria-label="Alt text"
                  defaultValue={m.alt ?? ""}
                  placeholder="Add alt text"
                  maxLength={200}
                  onBlur={(e) => setAlt(m, e.target.value.trim())}
                  className={cn(inputClass, "h-10", !m.alt && "border-caution")}
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={smallButton}
                    onClick={() => navigator.clipboard.writeText(m.url)}
                  >
                    <Copy className="size-4" aria-hidden />
                    Copy URL
                  </button>
                  {/* Authors may delete only their own uploads; the API says so if not. */}
                  <button
                    type="button"
                    className={dangerButton}
                    onClick={() => remove(m)}
                    aria-label="Delete image"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <Empty>No images yet. Upload covers and photos here, or straight from the editor.</Empty>
      )}
      {data.page < data.pages && (
        <div className="mt-6 text-center">
          <button type="button" className={smallButton} onClick={more}>
            Load more
          </button>
        </div>
      )}
    </>
  );
}
