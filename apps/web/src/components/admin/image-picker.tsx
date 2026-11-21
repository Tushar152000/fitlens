"use client";

import { ImagePlus, Upload } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { BlogMediaDto } from "@fitr8/contracts";
import { blogApi, BLOG_IMAGE_ACCEPT, uploadBlogImage } from "@/lib/admin/api";
import { cn } from "@/lib/cn";
import { Modal } from "./modal";
import { smallButton } from "./ui";

interface Page {
  media: BlogMediaDto[];
  page: number;
  pages: number;
}

/** Choose an image from the blog library, or upload a new one. */
export function ImagePicker({
  open,
  onClose,
  onPick,
  title = "Choose an image",
}: {
  open: boolean;
  onClose: () => void;
  onPick: (media: BlogMediaDto) => void;
  title?: string;
}) {
  const [data, setData] = useState<Page | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

  const load = useCallback((page: number) => {
    blogApi<Page>(`/media?page=${page}`)
      .then((next) =>
        setData((prev) =>
          page > 1 && prev ? { ...next, media: [...prev.media, ...next.media] } : next,
        ),
      )
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load images."));
  }, []);

  // Fresh list each time it opens (another tab may have uploaded meanwhile).
  useEffect(() => {
    if (!open) return;
    let live = true;
    blogApi<Page>("/media?page=1")
      .then((next) => live && setData(next))
      .catch(
        (err) => live && setError(err instanceof Error ? err.message : "Couldn't load images."),
      );
    return () => {
      live = false;
    };
  }, [open]);

  async function upload(f: File | undefined) {
    if (!f) return;
    setBusy(true);
    setError(null);
    try {
      const alt =
        window.prompt("Describe the image for screen readers and Google (alt text):", "") ?? "";
      const media = await uploadBlogImage(f, alt.trim() || null);
      onPick(media);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (file.current) file.current.value = "";
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={title} wide>
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className={smallButton}
          disabled={busy}
          onClick={() => file.current?.click()}
        >
          <Upload className="size-4" aria-hidden />
          {busy ? "Uploading…" : "Upload new"}
        </button>
        <input
          ref={file}
          type="file"
          accept={BLOG_IMAGE_ACCEPT}
          className="hidden"
          onChange={(e) => upload(e.target.files?.[0])}
        />
        <p className="text-[13px] text-ink-3">
          JPEG, PNG, WebP, GIF or AVIF, up to 10 MB. 1600 px wide works well.
        </p>
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[14px] font-semibold text-caution-text">
          {error}
        </p>
      )}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {data?.media.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => {
              onPick(m);
              onClose();
            }}
            className="group overflow-hidden rounded-input border border-line text-left hover:border-brand"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- library thumbnails */}
            <img
              src={m.url}
              alt={m.alt ?? ""}
              loading="lazy"
              className="aspect-[4/3] w-full bg-sunken object-cover"
            />
            <p
              className={cn(
                "truncate px-2 py-1.5 text-[12px]",
                m.alt ? "text-ink-2" : "font-semibold text-caution-text",
              )}
            >
              {m.alt || "No alt text"}
            </p>
          </button>
        ))}
      </div>
      {data && !data.media.length && (
        <div className="mt-6 flex flex-col items-center gap-2 py-8 text-ink-2">
          <ImagePlus className="size-8 text-ink-3" aria-hidden />
          No images yet. Upload the first one.
        </div>
      )}
      {data && data.page < data.pages && (
        <div className="mt-4 text-center">
          <button type="button" className={smallButton} onClick={() => load(data.page + 1)}>
            Load more
          </button>
        </div>
      )}
    </Modal>
  );
}
