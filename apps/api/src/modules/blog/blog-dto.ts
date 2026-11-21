import { Injectable } from "@nestjs/common";
import type { Prisma } from "@fitr8/db";
import type { BlogFaqItem, BlogTocEntry } from "@fitr8/contracts";
import { effectiveStatus, slugify } from "@fitr8/domain/blog";
import { InjectEnv, type Env } from "../../config/config.module.js";

/** Posts readers can see: published, or scheduled with the time passed. */
export const visiblePost = (now = new Date()): Prisma.BlogPostWhereInput => ({
  OR: [{ status: "PUBLISHED" }, { status: "SCHEDULED", publishedAt: { lte: now } }],
});

/** `base`, or `base-2`, `base-3`… whichever is free. */
export async function uniqueSlug(
  text: string,
  taken: (slug: string) => Promise<boolean>,
  fallback = "post",
): Promise<string> {
  const base = slugify(text) || fallback;
  for (let n = 1; n < 500; n++) {
    const candidate = n === 1 ? base : `${base.slice(0, 75)}-${n}`;
    if (!(await taken(candidate))) return candidate;
  }
  return `${base.slice(0, 60)}-${Date.now().toString(36)}`;
}

export const mediaSelect = {
  id: true,
  key: true,
  alt: true,
  contentType: true,
  createdAt: true,
} as const;
type MediaRow = Prisma.BlogMediaGetPayload<{ select: typeof mediaSelect }>;

/** Public URLs for blog images. They live in the private bucket and are streamed by the API. */
@Injectable()
export class BlogUrls {
  constructor(@InjectEnv() private readonly env: Env) {}

  /** https://api.fitr8.com/api/blog/media/<uuid>.<ext> */
  media(key: string): string {
    return `${this.env.API_PUBLIC_URL.replace(/\/+$/, "")}/api/blog/media/${key.replace(/^blog\//, "")}`;
  }

  mediaDto(m: MediaRow) {
    return {
      id: m.id,
      url: this.media(m.key),
      alt: m.alt,
      contentType: m.contentType,
      createdAt: m.createdAt,
    };
  }

  mediaOrNull(m: MediaRow | null | undefined) {
    return m ? this.mediaDto(m) : null;
  }

  /** The web page for a path: https://www.fitr8.com/blog/... */
  site(path: string): string {
    return `${this.env.PUBLIC_URL.replace(/\/+$/, "")}${path}`;
  }
}

export const summarySelect = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  coverAlt: true,
  publishedAt: true,
  updatedAt: true,
  readingMinutes: true,
  featured: true,
  cover: { select: { key: true } },
  category: { select: { slug: true, name: true } },
  author: { select: { slug: true, name: true, avatar: { select: { key: true } } } },
  tags: { select: { tag: { select: { slug: true, name: true } } } },
} as const satisfies Prisma.BlogPostSelect;
type SummaryRow = Prisma.BlogPostGetPayload<{ select: typeof summarySelect }>;

export function toSummary(urls: BlogUrls, p: SummaryRow) {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverUrl: p.cover ? urls.media(p.cover.key) : null,
    coverAlt: p.coverAlt,
    publishedAt: p.publishedAt,
    updatedAt: p.updatedAt,
    readingMinutes: p.readingMinutes,
    featured: p.featured,
    category: p.category,
    author: p.author
      ? {
          slug: p.author.slug,
          name: p.author.name,
          avatarUrl: p.author.avatar ? urls.media(p.author.avatar.key) : null,
        }
      : null,
    tags: p.tags.map((t) => t.tag),
  };
}

export const rowSelect = {
  id: true,
  slug: true,
  title: true,
  status: true,
  publishedAt: true,
  updatedAt: true,
  wordCount: true,
  featured: true,
  author: { select: { staffId: true, name: true } },
  category: { select: { id: true, name: true } },
} as const satisfies Prisma.BlogPostSelect;
type Row = Prisma.BlogPostGetPayload<{ select: typeof rowSelect }>;

export const toRow = ({ author, ...p }: Row, now = new Date()) => ({
  ...p,
  author: author ? { id: author.staffId, name: author.name } : null,
  status: effectiveStatus(p.status, p.publishedAt, now),
});

export const asToc = (v: Prisma.JsonValue) =>
  (Array.isArray(v) ? v : []) as unknown as BlogTocEntry[];
export const asFaq = (v: Prisma.JsonValue) =>
  (Array.isArray(v) ? v : []) as unknown as BlogFaqItem[];
export const asDoc = (v: Prisma.JsonValue) =>
  (v && typeof v === "object" && !Array.isArray(v) ? v : { type: "doc", content: [] }) as Record<
    string,
    unknown
  >;
