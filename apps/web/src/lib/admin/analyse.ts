/**
 * What the SEO checklist needs from the editor's HTML: subheadings, images without alt text and
 * link counts. String-based (no DOM) so it runs in tests and on every keystroke cheaply.
 */
export interface HtmlStats {
  headings: string[];
  imagesWithoutAlt: number;
  internalLinks: number;
  externalLinks: number;
}

const stripTags = (s: string) =>
  s
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();

export function analyseHtml(html: string, siteHosts: string[]): HtmlStats {
  const headings = [...html.matchAll(/<h[23][^>]*>([\s\S]*?)<\/h[23]>/gi)]
    .map((m) => stripTags(m[1] ?? ""))
    .filter(Boolean);
  const imagesWithoutAlt = [...html.matchAll(/<img\b[^>]*>/gi)].filter((m) => {
    const alt = /\balt\s*=\s*"([^"]*)"/i.exec(m[0]);
    return !alt || !alt[1]!.trim();
  }).length;
  let internalLinks = 0;
  let externalLinks = 0;
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*"([^"]*)"/gi)) {
    const href = m[1]!.trim();
    if (!href || href.startsWith("#") || href.startsWith("mailto:")) continue;
    if (href.startsWith("/")) {
      internalLinks++;
      continue;
    }
    try {
      const host = new URL(href).hostname.replace(/^www\./, "");
      if (siteHosts.some((h) => h.replace(/^www\./, "") === host)) internalLinks++;
      else externalLinks++;
    } catch {
      // not a URL: ignore
    }
  }
  return { headings, imagesWithoutAlt, internalLinks, externalLinks };
}

/** Plain text of editor HTML (for the word count and keyword checks). */
export const htmlText = (html: string) =>
  stripTags(html.replace(/<\/(p|h\d|li|blockquote|pre|td|th)>|<br\s*\/?>/gi, "$& "))
    .replace(/\s+/g, " ")
    .trim();
