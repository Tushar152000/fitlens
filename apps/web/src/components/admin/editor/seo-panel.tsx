"use client";

import { CheckCircle2, CircleAlert, CircleX } from "lucide-react";
import { useState } from "react";
import type { BlogMediaDto } from "@fitr8/contracts";
import { SEO_LIMITS, type SeoCheck } from "@fitr8/domain/blog";
import { cn } from "@/lib/cn";
import { SITE_URL } from "@/lib/site-url";
import { ImagePicker } from "../image-picker";
import { Field, inputClass, smallButton, textareaClass } from "../ui";

export interface SeoFields {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  noindex: boolean;
  ogImage: BlogMediaDto | null;
}

const counter = (n: number, max: number, min: number) => (
  <span
    className={cn(n > max ? "text-caution-text" : n && n < min ? "text-ink-3" : "text-protein")}
  >
    {n} / {max}
  </span>
);

const ICON = {
  good: <CheckCircle2 className="size-4 shrink-0 text-protein" aria-label="Done" />,
  warn: <CircleAlert className="size-4 shrink-0 text-carbs-text" aria-label="Worth fixing" />,
  bad: <CircleX className="size-4 shrink-0 text-fat" aria-label="Fix this" />,
};

/** Search and social: Google preview, meta fields, checklist with a score. */
export function SeoPanel({
  value,
  onChange,
  title,
  excerpt,
  slug,
  coverUrl,
  checks,
  score,
  disabled,
}: {
  value: SeoFields;
  onChange: (patch: Partial<SeoFields>) => void;
  title: string;
  excerpt: string;
  slug: string;
  coverUrl: string | null;
  checks: SeoCheck[];
  score: number;
  disabled: boolean;
}) {
  const [picking, setPicking] = useState(false);
  const shownTitle = value.metaTitle || title || "Untitled post";
  const shownDescription =
    value.metaDescription || excerpt || "Add a meta description to control this text.";
  const host = SITE_URL.replace(/^https?:\/\//, "");
  const social = value.ogImage?.url ?? coverUrl;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "grid size-12 place-items-center rounded-full text-[15px] font-bold tabular-nums",
            score >= 80
              ? "bg-protein-soft text-protein"
              : score >= 50
                ? "bg-caution-soft text-caution-text"
                : "bg-fat/10 text-fat",
          )}
        >
          {score}
        </div>
        <p className="text-[13px] text-ink-2">
          SEO score. Aim for 80+; the list below says what to fix.
        </p>
      </div>

      <div className="rounded-input border border-line bg-ground p-3.5" aria-label="Google preview">
        <p className="truncate text-[12px] text-ink-3">
          {host} › blog › {slug}
        </p>
        <p className="mt-0.5 line-clamp-1 text-[18px] leading-snug text-[#1a0dab]">{shownTitle}</p>
        <p className="mt-0.5 line-clamp-2 text-[13px] text-ink-2">{shownDescription}</p>
      </div>

      <Field
        label="Search title"
        htmlFor="seo-title"
        hint={
          <>
            Defaults to the post title.{" "}
            {counter(value.metaTitle.length, SEO_LIMITS.titleMax, SEO_LIMITS.titleMin)}
          </>
        }
      >
        <input
          id="seo-title"
          className={inputClass}
          value={value.metaTitle}
          maxLength={120}
          placeholder={title}
          disabled={disabled}
          onChange={(e) => onChange({ metaTitle: e.target.value })}
        />
      </Field>
      <Field
        label="Meta description"
        htmlFor="seo-desc"
        hint={
          <>
            Defaults to the excerpt.{" "}
            {counter(
              value.metaDescription.length,
              SEO_LIMITS.descriptionMax,
              SEO_LIMITS.descriptionMin,
            )}
          </>
        }
      >
        <textarea
          id="seo-desc"
          rows={3}
          className={textareaClass}
          value={value.metaDescription}
          maxLength={320}
          placeholder={excerpt}
          disabled={disabled}
          onChange={(e) => onChange({ metaDescription: e.target.value })}
        />
      </Field>
      <Field
        label="Focus keyword"
        htmlFor="seo-kw"
        hint="The search you want this post to rank for, e.g. “protein for vegetarians”."
      >
        <input
          id="seo-kw"
          className={inputClass}
          value={value.focusKeyword}
          maxLength={80}
          disabled={disabled}
          onChange={(e) => onChange({ focusKeyword: e.target.value })}
        />
      </Field>

      <ul className="flex flex-col gap-2" aria-label="SEO checklist">
        {checks.map((c) => (
          <li key={c.id} className="flex items-start gap-2 text-[13px] text-ink-2">
            {ICON[c.level]}
            {c.message}
          </li>
        ))}
      </ul>

      <div>
        <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Social image</p>
        {social ? (
          // eslint-disable-next-line @next/next/no-img-element -- library image
          <img
            src={social}
            alt=""
            className="aspect-[1200/630] w-full rounded-input border border-line object-cover"
          />
        ) : (
          <div className="grid aspect-[1200/630] place-items-center rounded-input border border-dashed border-line-strong text-[13px] text-ink-3">
            No image: add a cover or a social image
          </div>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            className={smallButton}
            disabled={disabled}
            onClick={() => setPicking(true)}
          >
            {value.ogImage ? "Change" : "Use a different image"}
          </button>
          {value.ogImage && (
            <button
              type="button"
              className={smallButton}
              disabled={disabled}
              onClick={() => onChange({ ogImage: null })}
            >
              Use the cover
            </button>
          )}
        </div>
        <p className="mt-1 text-[12px] text-ink-3">
          Shown on WhatsApp, X, LinkedIn. 1200 × 630 is ideal.
        </p>
      </div>

      <Field
        label="Canonical URL"
        htmlFor="seo-canonical"
        hint="Only if this post was first published elsewhere."
      >
        <input
          id="seo-canonical"
          type="url"
          className={inputClass}
          value={value.canonicalUrl}
          placeholder={`${SITE_URL}/blog/${slug}`}
          disabled={disabled}
          onChange={(e) => onChange({ canonicalUrl: e.target.value })}
        />
      </Field>
      <label className="flex items-start gap-3 text-[14px]">
        <input
          type="checkbox"
          className="mt-1 size-4 accent-brand"
          checked={value.noindex}
          disabled={disabled}
          onChange={(e) => onChange({ noindex: e.target.checked })}
        />
        <span>
          <span className="font-semibold">Hide from search engines</span>
          <span className="block text-[13px] text-ink-3">
            Adds noindex and leaves it out of the sitemap and RSS.
          </span>
        </span>
      </label>
      <ImagePicker
        open={picking}
        onClose={() => setPicking(false)}
        onPick={(m) => onChange({ ogImage: m })}
        title="Social image"
      />
    </div>
  );
}
