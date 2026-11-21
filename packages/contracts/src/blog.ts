/**
 * Blog wire contract: public reads (/api/blog/*) and the staff admin (/api/blog/admin/*).
 * Rules (slugs, roles, SEO checks) live in @fitr8/domain/blog.
 */
import { z } from "zod";
import type { StaffRole } from "@fitr8/domain/staff";
import { SLUG_MAX, SLUG_PATTERN, type StoredPostStatus } from "@fitr8/domain/blog";

const slug = z
  .string()
  .trim()
  .max(SLUG_MAX)
  .regex(SLUG_PATTERN, "Use lower-case words joined by hyphens, like high-protein-breakfasts");
const text = (max: number) => z.string().trim().max(max);
/** Optional text: "" clears it (stored as null). */
const clearable = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));
const id = z.string().min(1).max(40);
const page = z.coerce.number().int().min(1).max(1000).default(1);
const httpsUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((v) => /^https?:\/\//.test(v), "Use an http(s) link");

export const BLOG_POST_STATUSES = ["DRAFT", "SCHEDULED", "PUBLISHED"] as const;
export const BLOG_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
] as const;
export const BLOG_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const BLOG_PAGE_SIZE = 12;
export const BLOG_ADMIN_PAGE_SIZE = 25;

// ── Public queries ───────────────────────────────────────────────────────

export const BlogPostListQuerySchema = z.object({
  page,
  category: slug.optional(),
  tag: slug.optional(),
  author: slug.optional(),
  q: text(100).optional(),
});
export type BlogPostListQuery = z.infer<typeof BlogPostListQuerySchema>;

// ── Admin requests ───────────────────────────────────────────────────────

export const BlogAdminPostQuerySchema = z.object({
  page,
  status: z.enum(BLOG_POST_STATUSES).optional(),
  q: text(100).optional(),
  /** "1": only the caller's posts. */
  mine: z.enum(["0", "1"]).optional(),
});
export type BlogAdminPostQuery = z.infer<typeof BlogAdminPostQuerySchema>;

export const BlogPostCreateSchema = z.object({ title: text(200).optional() });
export type BlogPostCreateInput = z.infer<typeof BlogPostCreateSchema>;

export const BlogFaqItemSchema = z.object({
  question: text(300).min(1, "Write the question"),
  answer: text(3000).min(1, "Write the answer"),
});
export type BlogFaqItem = z.infer<typeof BlogFaqItemSchema>;

/** Every field optional: the editor autosaves whatever changed. */
export const BlogPostUpdateSchema = z
  .object({
    title: text(200),
    slug,
    excerpt: clearable(300),
    /** The Tiptap document. The API trusts only contentHtml after sanitising it. */
    contentJson: z.record(z.string(), z.unknown()),
    contentHtml: z.string().max(800_000),
    featured: z.boolean(),
    coverId: id.nullable(),
    coverAlt: clearable(200),
    categoryId: id.nullable(),
    tagIds: z.array(id).max(20),
    authorId: id,
    metaTitle: clearable(120),
    metaDescription: clearable(320),
    canonicalUrl: httpsUrl.nullable().or(z.literal("").transform(() => null)),
    noindex: z.boolean(),
    ogImageId: id.nullable(),
    focusKeyword: clearable(80),
    faq: z.array(BlogFaqItemSchema).max(20),
    /** The updatedAt the editor last saw: someone else saved since → 409 instead of overwriting. */
    baseUpdatedAt: z.string().datetime().optional(),
    /** Take a revision now ("Save version"), not only on the autosave schedule. */
    snapshot: z.boolean().optional(),
  })
  .partial()
  .refine((v) => (v.contentJson === undefined) === (v.contentHtml === undefined), {
    message: "Send contentJson and contentHtml together",
    path: ["contentHtml"],
  });
export type BlogPostUpdateInput = z.infer<typeof BlogPostUpdateSchema>;

export const BlogPublishSchema = z.object({
  /** Future time → scheduled; absent or past → live now. */
  publishAt: z.string().datetime().optional(),
});
export type BlogPublishInput = z.infer<typeof BlogPublishSchema>;

export const BlogCategoryInputSchema = z.object({
  name: text(80).min(1, "Give it a name"),
  slug: slug.optional(),
  description: clearable(500),
  metaTitle: clearable(120),
  metaDescription: clearable(320),
});
export type BlogCategoryInput = z.infer<typeof BlogCategoryInputSchema>;

export const BlogTagInputSchema = z.object({
  name: text(60).min(1, "Give it a name"),
  slug: slug.optional(),
  description: clearable(500),
});
export type BlogTagInput = z.infer<typeof BlogTagInputSchema>;

export const BlogMediaUploadSchema = z.object({
  contentType: z.enum(BLOG_IMAGE_TYPES, { message: "Use a JPEG, PNG, WebP, GIF or AVIF image" }),
  sizeBytes: z.number().int().positive().max(BLOG_IMAGE_MAX_BYTES, "Images can be up to 10 MB"),
  alt: clearable(200),
});
export type BlogMediaUploadInput = z.infer<typeof BlogMediaUploadSchema>;

export const BlogMediaUpdateSchema = z.object({ alt: clearable(200) });
export type BlogMediaUpdateInput = z.infer<typeof BlogMediaUpdateSchema>;

export const BlogProfileSchema = z.object({
  name: text(80).min(1, "Add your name"),
  slug,
  bio: clearable(600),
  avatarId: id.nullable(),
  website: httpsUrl.nullable().or(z.literal("").transform(() => null)),
  twitter: clearable(40),
  linkedin: httpsUrl.nullable().or(z.literal("").transform(() => null)),
});
export type BlogProfileInput = z.infer<typeof BlogProfileSchema>;

export const BlogRedirectInputSchema = z.object({
  fromSlug: slug,
  toPath: z
    .string()
    .trim()
    .max(500)
    .refine(
      (v) => /^\/(?![/\\])/.test(v) || v.startsWith("https://"),
      "Use a site path like /blog/new-post or an https link",
    ),
});
export type BlogRedirectInput = z.infer<typeof BlogRedirectInputSchema>;

// ── Responses ────────────────────────────────────────────────────────────

export interface BlogMediaDto {
  id: string;
  url: string;
  alt: string | null;
  contentType: string;
  createdAt: string;
}

export interface BlogAuthorDto {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatarUrl: string | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
}

export interface BlogCategoryDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  metaTitle: string | null;
  metaDescription: string | null;
  postCount: number;
}

export interface BlogTagDto {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  postCount: number;
}

export interface BlogTocEntry {
  id: string;
  text: string;
  level: 2 | 3;
}

export interface BlogPostSummaryDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  coverAlt: string | null;
  publishedAt: string | null;
  updatedAt: string;
  readingMinutes: number;
  featured: boolean;
  category: { slug: string; name: string } | null;
  author: { slug: string; name: string; avatarUrl: string | null } | null;
  tags: { slug: string; name: string }[];
}

export interface BlogPostDto extends BlogPostSummaryDto {
  contentHtml: string;
  toc: BlogTocEntry[];
  faq: BlogFaqItem[];
  wordCount: number;
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  ogImageUrl: string | null;
  authorProfile: BlogAuthorDto | null;
  related: BlogPostSummaryDto[];
}

export interface BlogPostPageDto {
  posts: BlogPostSummaryDto[];
  page: number;
  pages: number;
  total: number;
}

/** 404 body details when the slug moved: the web answers with a permanent redirect. */
export interface BlogMovedDetails {
  redirectTo: string;
}

export interface BlogSitemapDto {
  posts: { slug: string; updatedAt: string }[];
  categories: { slug: string; updatedAt: string }[];
  tags: { slug: string }[];
  authors: { slug: string }[];
}

/** The caller's own author profile in the admin (GET/PUT /api/admin/blog/profile). */
export interface BlogAuthorProfileDto {
  staffId: string;
  slug: string;
  name: string;
  bio: string | null;
  avatar: BlogMediaDto | null;
  website: string | null;
  twitter: string | null;
  linkedin: string | null;
  postCount: number;
}

/** Someone a post can be assigned to (every staff member; GET /api/admin/blog/authors). */
export interface BlogAuthorOptionDto {
  staffId: string;
  name: string;
  role: StaffRole;
}

export interface BlogAdminPostRowDto {
  id: string;
  slug: string;
  title: string;
  status: StoredPostStatus;
  publishedAt: string | null;
  updatedAt: string;
  wordCount: number;
  featured: boolean;
  author: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
}

export interface BlogAdminPostPageDto {
  posts: BlogAdminPostRowDto[];
  page: number;
  pages: number;
  total: number;
  counts: Record<StoredPostStatus, number>;
}

export interface BlogAdminPostDto {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentJson: Record<string, unknown>;
  contentHtml: string;
  contentText: string;
  toc: BlogTocEntry[];
  wordCount: number;
  readingMinutes: number;
  /** Effective status: a scheduled post whose time has passed shows as PUBLISHED. */
  status: StoredPostStatus;
  publishedAt: string | null;
  featured: boolean;
  cover: BlogMediaDto | null;
  coverAlt: string | null;
  authorId: string | null;
  categoryId: string | null;
  tagIds: string[];
  metaTitle: string | null;
  metaDescription: string | null;
  canonicalUrl: string | null;
  noindex: boolean;
  ogImage: BlogMediaDto | null;
  focusKeyword: string | null;
  faq: BlogFaqItem[];
  createdAt: string;
  updatedAt: string;
  can: { edit: boolean; publish: boolean; delete: boolean };
}

export interface BlogRevisionDto {
  id: string;
  title: string;
  reason: string;
  createdAt: string;
  member: { id: string; name: string } | null;
}

export interface BlogRevisionDetailDto extends BlogRevisionDto {
  excerpt: string | null;
  contentHtml: string;
}

export interface BlogRedirectDto {
  id: string;
  fromSlug: string;
  toPath: string;
  auto: boolean;
  createdAt: string;
}

export interface BlogStatsDto {
  counts: Record<StoredPostStatus, number> & {
    categories: number;
    tags: number;
    media: number;
  };
  recent: BlogAdminPostRowDto[];
  upcoming: BlogAdminPostRowDto[];
}
