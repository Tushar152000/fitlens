/**
 * Blog rules shared by the API (enforcement) and the admin editor (live hints): slugs, reading
 * time, who may do what, the public status of a post and the SEO checklist. Pure, no I/O.
 */

import { staffCan, type StaffRole } from "./staff.js";

// ── Slugs ────────────────────────────────────────────────────────────────

export const SLUG_MAX = 80;
/** Lower-case words joined by single hyphens: "high-protein-veg-breakfasts". */
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** A URL slug from any text: accents dropped, anything else becomes one hyphen, at most SLUG_MAX. */
export function slugify(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, SLUG_MAX)
    .replace(/-+$/g, "");
}

export const isValidSlug = (slug: string) => slug.length <= SLUG_MAX && SLUG_PATTERN.test(slug);

/** /blog/<slug> can't shadow the blog's own routes (/blog/category/…, /blog/tag/…). */
export const RESERVED_POST_SLUGS = [
  "category",
  "tag",
  "author",
  "page",
  "rss",
  "feed",
  "search",
] as const;
export const isReservedPostSlug = (slug: string) =>
  (RESERVED_POST_SLUGS as readonly string[]).includes(slug);

// ── Reading time ─────────────────────────────────────────────────────────

export const WORDS_PER_MINUTE = 220;

export function countWords(text: string): number {
  const words = text.trim().match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu);
  return words ? words.length : 0;
}

/** Words and whole minutes to read (at least 1 once there is any text). */
export function readingStats(text: string): { words: number; minutes: number } {
  const words = countWords(text);
  return { words, minutes: words ? Math.max(1, Math.round(words / WORDS_PER_MINUTE)) : 0 };
}

// ── Roles ────────────────────────────────────────────────────────────

export type BlogAction =
  /** Open the blog section, write drafts, upload images, edit own author profile. */
  | "write"
  /** Edit or delete a post (`own` = the caller is its author). */
  | "edit-post"
  | "delete-post"
  /** Publish, schedule or unpublish. */
  | "publish"
  /** Choose another staff member as a post's author. */
  | "assign-author"
  /** Categories, tags, redirects, everyone's images. */
  | "manage-content";

/**
 * The blog section's permissions for a staff role: authors write and edit their own unpublished
 * posts; editors run the whole blog; admins too (the team itself is `staffCan`).
 */
export function blogCan(
  role: StaffRole,
  action: BlogAction,
  ctx: { own?: boolean; published?: boolean } = {},
): boolean {
  if (role === "ADMIN" || role === "EDITOR") return true;
  switch (action) {
    case "write":
      return true;
    case "edit-post":
    case "delete-post":
      return Boolean(ctx.own) && !ctx.published;
    default:
      return false;
  }
}

/** Admins can manage the team; re-exported for callers that only import the blog rules. */
export { staffCan };

// ── Status ───────────────────────────────────────────────────────────────

export type StoredPostStatus = "DRAFT" | "SCHEDULED" | "PUBLISHED";

/** What readers see: a scheduled post becomes published once its time has passed (no job needed). */
export function effectiveStatus(
  status: StoredPostStatus,
  publishedAt: Date | null,
  now = new Date(),
): StoredPostStatus {
  if (status === "SCHEDULED" && publishedAt && publishedAt <= now) return "PUBLISHED";
  return status;
}

// ── SEO checklist ────────────────────────────────────────────────────────

export const SEO_LIMITS = {
  titleMax: 60,
  titleMin: 30,
  descriptionMax: 160,
  descriptionMin: 70,
  minWords: 300,
  excerptMax: 300,
} as const;

export interface SeoInput {
  title: string;
  metaTitle?: string | null;
  metaDescription?: string | null;
  excerpt?: string | null;
  slug: string;
  /** Plain text of the body. */
  text: string;
  /** Texts of the h2/h3 headings. */
  headings: string[];
  focusKeyword?: string | null;
  hasCover: boolean;
  imagesWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
}

export interface SeoCheck {
  id: string;
  /** good = done, warn = worth fixing, bad = hurts the post. */
  level: "good" | "warn" | "bad";
  message: string;
}

const lower = (s: string) => s.toLowerCase();

/** The checklist the editor shows beside a post, plus a 0–100 score (good = 1, warn = ½). */
export function seoChecks(input: SeoInput): { score: number; checks: SeoCheck[] } {
  const checks: SeoCheck[] = [];
  const add = (id: string, level: SeoCheck["level"], message: string) =>
    checks.push({ id, level, message });

  const title = (input.metaTitle || input.title).trim();
  if (!title) add("title", "bad", "Add a title.");
  else if (title.length > SEO_LIMITS.titleMax)
    add("title", "warn", `Search title is ${title.length} characters; Google shows about 60.`);
  else if (title.length < SEO_LIMITS.titleMin)
    add("title", "warn", `Search title is short (${title.length}); aim for 30–60 characters.`);
  else add("title", "good", "Search title length is good.");

  const description = (input.metaDescription || input.excerpt || "").trim();
  if (!description) add("description", "bad", "Add a meta description (or an excerpt).");
  else if (description.length > SEO_LIMITS.descriptionMax)
    add(
      "description",
      "warn",
      `Description is ${description.length} characters; Google cuts it near 160.`,
    );
  else if (description.length < SEO_LIMITS.descriptionMin)
    add("description", "warn", "Description is short; aim for 70–160 characters.");
  else add("description", "good", "Meta description length is good.");

  const { words } = readingStats(input.text);
  if (words < SEO_LIMITS.minWords)
    add("length", "warn", `${words} words. Posts under 300 words rarely rank.`);
  else add("length", "good", `${words} words.`);

  if (!input.headings.length) add("headings", "warn", "Break the post up with H2 headings.");
  else add("headings", "good", "Uses subheadings.");

  if (!input.hasCover) add("cover", "warn", "Add a cover image: it is the preview on social.");
  else add("cover", "good", "Has a cover image.");

  if (input.imagesWithoutAlt > 0)
    add("alt", "bad", `${input.imagesWithoutAlt} image(s) without alt text.`);
  else add("alt", "good", "Every image has alt text.");

  if (!input.internalLinks) add("internal-links", "warn", "Link to at least one other FITR8 page.");
  else add("internal-links", "good", "Links to other FITR8 pages.");

  if (!input.externalLinks) add("external-links", "warn", "Cite a source with an outbound link.");
  else add("external-links", "good", "Cites outside sources.");

  const keyword = input.focusKeyword?.trim();
  if (keyword) {
    const k = lower(keyword);
    const slugWords = slugify(keyword);
    add(
      "kw-title",
      lower(title).includes(k) ? "good" : "warn",
      lower(title).includes(k)
        ? "Focus keyword is in the title."
        : "Put the focus keyword in the title.",
    );
    add(
      "kw-description",
      lower(description).includes(k) ? "good" : "warn",
      lower(description).includes(k)
        ? "Focus keyword is in the description."
        : "Use the focus keyword in the description.",
    );
    add(
      "kw-slug",
      slugWords && input.slug.includes(slugWords) ? "good" : "warn",
      slugWords && input.slug.includes(slugWords)
        ? "Focus keyword is in the URL."
        : "Use the focus keyword in the URL.",
    );
    const intro = lower(input.text.trim().split(/\s+/).slice(0, 100).join(" "));
    add(
      "kw-intro",
      intro.includes(k) ? "good" : "warn",
      intro.includes(k)
        ? "Focus keyword appears early."
        : "Mention the focus keyword in the first paragraph.",
    );
    add(
      "kw-heading",
      input.headings.some((h) => lower(h).includes(k)) ? "good" : "warn",
      input.headings.some((h) => lower(h).includes(k))
        ? "Focus keyword is in a subheading."
        : "Use the focus keyword in a subheading.",
    );
  } else {
    add("keyword", "warn", "Set a focus keyword to get keyword tips.");
  }

  const points = checks.reduce(
    (s, c) => s + (c.level === "good" ? 1 : c.level === "warn" ? 0.5 : 0),
    0,
  );
  return { score: Math.round((points / checks.length) * 100), checks };
}
