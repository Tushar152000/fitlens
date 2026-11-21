import { describe, expect, it } from "vitest";
import {
  blogCan,
  isReservedPostSlug,
  countWords,
  effectiveStatus,
  isValidSlug,
  readingStats,
  seoChecks,
  slugify,
  SLUG_MAX,
  type SeoInput,
} from "./blog.js";

describe("slugify", () => {
  it("lower-cases and hyphenates", () => {
    expect(slugify("  High-Protein Veg Breakfasts!  ")).toBe("high-protein-veg-breakfasts");
    expect(slugify("Dal & Rice: 101")).toBe("dal-and-rice-101");
    expect(slugify("Café crème")).toBe("cafe-creme");
    expect(slugify("---")).toBe("");
  });

  it("caps the length without a trailing hyphen", () => {
    const slug = slugify(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(SLUG_MAX);
    expect(slug.endsWith("-")).toBe(false);
  });

  it("validates", () => {
    expect(isValidSlug("good-slug-2")).toBe(true);
    expect(isValidSlug("Bad")).toBe(false);
    expect(isValidSlug("double--hyphen")).toBe(false);
    expect(isValidSlug("-lead")).toBe(false);
    expect(isValidSlug("a".repeat(SLUG_MAX + 1))).toBe(false);
  });
});

describe("isReservedPostSlug", () => {
  it("keeps the blog's own route names", () => {
    expect(isReservedPostSlug("category")).toBe(true);
    expect(isReservedPostSlug("tag")).toBe(true);
    expect(isReservedPostSlug("tagged-posts")).toBe(false);
  });
});

describe("readingStats", () => {
  it("counts words and minutes", () => {
    expect(countWords("")).toBe(0);
    expect(countWords("it's a well-known — fact, 100%")).toBe(5);
    expect(readingStats("")).toEqual({ words: 0, minutes: 0 });
    expect(readingStats("one").minutes).toBe(1);
    expect(readingStats(Array(660).fill("w").join(" ")).minutes).toBe(3);
  });
});

describe("blogCan", () => {
  it("lets admins and editors run the whole blog", () => {
    expect(blogCan("ADMIN", "edit-post", { own: false, published: true })).toBe(true);
    expect(blogCan("EDITOR", "publish")).toBe(true);
    expect(blogCan("EDITOR", "manage-content")).toBe(true);
    expect(blogCan("EDITOR", "delete-post", { own: false, published: true })).toBe(true);
  });

  it("limits authors to their own unpublished posts", () => {
    expect(blogCan("AUTHOR", "write")).toBe(true);
    expect(blogCan("AUTHOR", "edit-post", { own: true, published: false })).toBe(true);
    expect(blogCan("AUTHOR", "edit-post", { own: true, published: true })).toBe(false);
    expect(blogCan("AUTHOR", "edit-post", { own: false, published: false })).toBe(false);
    expect(blogCan("AUTHOR", "delete-post", { own: true })).toBe(true);
    for (const action of ["publish", "assign-author", "manage-content"] as const)
      expect(blogCan("AUTHOR", action)).toBe(false);
  });
});

describe("effectiveStatus", () => {
  const now = new Date("2026-11-22T10:00:00Z");
  it("publishes a scheduled post once its time has come", () => {
    expect(effectiveStatus("SCHEDULED", new Date("2026-11-22T09:59:00Z"), now)).toBe("PUBLISHED");
    expect(effectiveStatus("SCHEDULED", new Date("2026-11-23T00:00:00Z"), now)).toBe("SCHEDULED");
    expect(effectiveStatus("SCHEDULED", null, now)).toBe("SCHEDULED");
    expect(effectiveStatus("DRAFT", new Date("2020-01-01"), now)).toBe("DRAFT");
    expect(effectiveStatus("PUBLISHED", null, now)).toBe("PUBLISHED");
  });
});

describe("seoChecks", () => {
  const words = (n: number, w = "word") => Array(n).fill(w).join(" ");
  const base: SeoInput = {
    title: "Protein for vegetarians: how much you need daily",
    metaDescription:
      "A clear guide to protein for vegetarians in India: how much you need, the best foods and an easy day of meals.",
    slug: "protein-for-vegetarians",
    text: `Protein for vegetarians matters. ${words(400)}`,
    headings: ["Best protein for vegetarians", "A day of meals"],
    focusKeyword: "protein for vegetarians",
    hasCover: true,
    imagesWithoutAlt: 0,
    internalLinks: 2,
    externalLinks: 1,
  };

  it("scores a well-optimised post 100", () => {
    const { score, checks } = seoChecks(base);
    expect(checks.every((c) => c.level === "good")).toBe(true);
    expect(score).toBe(100);
  });

  it("flags missing basics", () => {
    const { score, checks } = seoChecks({
      ...base,
      title: "",
      metaDescription: "",
      excerpt: "",
      text: "short",
      headings: [],
      hasCover: false,
      imagesWithoutAlt: 2,
      internalLinks: 0,
      externalLinks: 0,
      focusKeyword: null,
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.level]));
    expect(byId).toMatchObject({
      title: "bad",
      description: "bad",
      length: "warn",
      headings: "warn",
      cover: "warn",
      alt: "bad",
      "internal-links": "warn",
      "external-links": "warn",
      keyword: "warn",
    });
    expect(score).toBeLessThan(50);
  });

  it("warns on lengths and a keyword that isn't used", () => {
    const { checks } = seoChecks({
      ...base,
      metaTitle: "x".repeat(70),
      metaDescription: "too short",
      focusKeyword: "paneer",
    });
    const byId = Object.fromEntries(checks.map((c) => [c.id, c.level]));
    expect(byId.title).toBe("warn");
    expect(byId.description).toBe("warn");
    for (const id of ["kw-title", "kw-description", "kw-slug", "kw-intro", "kw-heading"])
      expect(byId[id]).toBe("warn");
    expect(seoChecks({ ...base, metaTitle: "Short" }).checks[0]!.level).toBe("warn");
    expect(
      seoChecks({ ...base, metaDescription: "y".repeat(200) }).checks.find(
        (c) => c.id === "description",
      )!.level,
    ).toBe("warn");
  });

  it("falls back to the excerpt for the description", () => {
    const { checks } = seoChecks({ ...base, metaDescription: null, excerpt: base.metaDescription });
    expect(checks.find((c) => c.id === "description")!.level).toBe("good");
  });
});
