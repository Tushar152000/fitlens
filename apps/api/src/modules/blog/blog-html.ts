import sanitizeHtml from "sanitize-html";
import { readingStats, slugify } from "@fitr8/domain/blog";
import type { BlogTocEntry } from "@fitr8/contracts";

/**
 * Editor HTML → what /blog renders. Only the tags the Tiptap editor produces survive; scripts,
 * styles, event handlers and javascript: links never do. Authors are staff, but an AUTHOR is the
 * lowest-trust role and published HTML runs on www.fitr8.com, so it is always sanitised here.
 */
const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p",
    "br",
    "h2",
    "h3",
    "h4",
    "strong",
    "b",
    "em",
    "i",
    "u",
    "s",
    "mark",
    "sub",
    "sup",
    "code",
    "pre",
    "blockquote",
    "ul",
    "ol",
    "li",
    "a",
    "img",
    "figure",
    "figcaption",
    "hr",
    "table",
    "thead",
    "tbody",
    "tr",
    "th",
    "td",
    "colgroup",
    "col",
    "div",
    "iframe",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "title", "width", "height"],
    iframe: ["src", "width", "height", "allowfullscreen", "title"],
    th: ["colspan", "rowspan"],
    td: ["colspan", "rowspan"],
    ol: ["start"],
    code: ["class"],
    div: ["data-youtube-video"],
  },
  allowedClasses: { code: [/^language-[\w-]+$/] },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesByTag: { img: ["http", "https"] },
  allowProtocolRelative: false,
  allowedIframeHostnames: ["www.youtube.com", "www.youtube-nocookie.com"],
  transformTags: {
    // The post title is the page's only h1.
    h1: "h2",
    a: (tagName, attribs) => {
      const out: sanitizeHtml.Attributes = { ...attribs };
      if (out.target && out.target !== "_blank") delete out.target;
      if (out.target === "_blank") {
        const rel = new Set((out.rel ?? "").split(/\s+/).filter(Boolean));
        rel.add("noopener");
        rel.add("noreferrer");
        out.rel = [...rel].join(" ");
      }
      return { tagName, attribs: out };
    },
    img: (tagName, attribs) => ({ tagName, attribs: { ...attribs, loading: "lazy" } }),
  },
};
// loading="lazy" is added by the transform above, so it has to be allowed too.
(OPTIONS.allowedAttributes as Record<string, string[]>).img!.push("loading");

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&#x27;": "'",
  "&nbsp;": " ",
};
const decode = (s: string) => s.replace(/&(?:amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m]!);

/** Plain text of (sanitised) HTML: block ends become spaces, entities decoded, whitespace collapsed. */
export function htmlToText(html: string): string {
  const spaced = html.replace(
    /<\/(p|h\d|li|blockquote|pre|td|th|figcaption|div)>|<br\s*\/?>/g,
    "$& ",
  );
  const stripped = sanitizeHtml(spaced, { allowedTags: [], allowedAttributes: {} });
  return decode(stripped).replace(/\s+/g, " ").trim();
}

export interface RenderedPost {
  html: string;
  text: string;
  toc: BlogTocEntry[];
  words: number;
  minutes: number;
}

/** Sanitise, give every h2/h3 a unique id (for the table of contents and #links), and measure it. */
export function renderPostHtml(raw: string): RenderedPost {
  const clean = sanitizeHtml(raw, OPTIONS);
  const toc: BlogTocEntry[] = [];
  const used = new Map<string, number>();
  // After sanitising, h2/h3 carry no attributes, so the exact "<h2>" form is the only one left.
  const html = clean.replace(/<h([23])>([\s\S]*?)<\/h\1>/g, (_, level: string, inner: string) => {
    const text = htmlToText(inner);
    if (!text) return `<h${level}>${inner}</h${level}>`;
    const base = slugify(text) || "section";
    const n = (used.get(base) ?? 0) + 1;
    used.set(base, n);
    const id = n === 1 ? base : `${base}-${n}`;
    toc.push({ id, text, level: Number(level) as 2 | 3 });
    return `<h${level} id="${id}">${inner}</h${level}>`;
  });
  const text = htmlToText(clean);
  const { words, minutes } = readingStats(text);
  return { html, text, toc, words, minutes };
}

const escapeXml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!,
  );

export interface FeedItem {
  title: string;
  url: string;
  description: string;
  publishedAt: Date;
  author?: string | null;
  categories: string[];
}

/** RSS 2.0 for /api/blog/rss.xml. */
export function rssFeed(
  channel: { title: string; link: string; description: string; self: string },
  items: FeedItem[],
): string {
  const lines = items.map(
    (i) => `    <item>
      <title>${escapeXml(i.title)}</title>
      <link>${escapeXml(i.url)}</link>
      <guid isPermaLink="true">${escapeXml(i.url)}</guid>
      <pubDate>${i.publishedAt.toUTCString()}</pubDate>
      <description>${escapeXml(i.description)}</description>${i.author ? `\n      <dc:creator>${escapeXml(i.author)}</dc:creator>` : ""}${i.categories.map((c) => `\n      <category>${escapeXml(c)}</category>`).join("")}
    </item>`,
  );
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(channel.title)}</title>
    <link>${escapeXml(channel.link)}</link>
    <description>${escapeXml(channel.description)}</description>
    <language>en</language>
    <atom:link href="${escapeXml(channel.self)}" rel="self" type="application/rss+xml"/>${items[0] ? `\n    <lastBuildDate>${items[0].publishedAt.toUTCString()}</lastBuildDate>` : ""}
${lines.join("\n")}
  </channel>
</rss>
`;
}
