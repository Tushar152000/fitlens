import { describe, expect, it } from "vitest";
import { htmlToText, renderPostHtml, rssFeed } from "./blog-html.js";

describe("renderPostHtml", () => {
  it("strips scripts, handlers and javascript: links", () => {
    const { html } = renderPostHtml(
      `<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">x</a><img src="x" onerror="y()"><style>p{}</style>`,
    );
    expect(html).not.toMatch(/script|onclick|onerror|javascript|style/);
    expect(html).toContain("<p>Hi</p>");
  });

  it("keeps editor formatting, tables and YouTube embeds only", () => {
    const { html } = renderPostHtml(
      `<h2>A</h2><ul><li><strong>b</strong></li></ul><table><tbody><tr><td colspan="2">c</td></tr></tbody></table>` +
        `<div data-youtube-video><iframe src="https://www.youtube-nocookie.com/embed/abc"></iframe></div>` +
        `<iframe src="https://evil.example/embed"></iframe><pre><code class="language-ts evil">x</code></pre>`,
    );
    expect(html).toContain(`<td colspan="2">c</td>`);
    expect(html).toContain("youtube-nocookie.com/embed/abc");
    expect(html).not.toContain("evil.example");
    expect(html).toContain(`<code class="language-ts">`);
  });

  it("turns h1 into h2, ids the headings and builds the table of contents", () => {
    const { html, toc } = renderPostHtml(
      `<h1>Intro</h1><h2 id="spoof">Protein &amp; you</h2><h3>Tips</h3><h2>Protein &amp; you</h2><h2></h2>`,
    );
    expect(toc).toEqual([
      { id: "intro", text: "Intro", level: 2 },
      { id: "protein-and-you", text: "Protein & you", level: 2 },
      { id: "tips", text: "Tips", level: 3 },
      { id: "protein-and-you-2", text: "Protein & you", level: 2 },
    ]);
    expect(html).toContain(`<h2 id="protein-and-you">Protein &amp; you</h2>`);
    expect(html).not.toContain("spoof");
  });

  it("secures new-tab links and lazy-loads images", () => {
    const { html } = renderPostHtml(
      `<a href="https://x.com" target="_blank">x</a><a href="/blog" target="_top">y</a><img src="https://cdn/x.jpg" alt="Dal">`,
    );
    expect(html).toContain(`rel="noopener noreferrer"`);
    expect(html).not.toContain("_top");
    expect(html).toContain(`loading="lazy"`);
  });

  it("measures text", () => {
    const { text, words, minutes } = renderPostHtml(`<p>One two</p><p>three&nbsp;four</p>`);
    expect(text).toBe("One two three four");
    expect(words).toBe(4);
    expect(minutes).toBe(1);
    expect(htmlToText("")).toBe("");
  });
});

describe("rssFeed", () => {
  it("escapes and lists items", () => {
    const xml = rssFeed(
      {
        title: "FITR8 & co",
        link: "https://fitr8.com/blog",
        description: "d",
        self: "https://api/rss",
      },
      [
        {
          title: "<Dal>",
          url: "https://fitr8.com/blog/dal",
          description: "x",
          publishedAt: new Date("2026-11-01T00:00:00Z"),
          author: "Asha",
          categories: ["Food"],
        },
      ],
    );
    expect(xml).toContain("<title>FITR8 &amp; co</title>");
    expect(xml).toContain("<title>&lt;Dal&gt;</title>");
    expect(xml).toContain("<dc:creator>Asha</dc:creator>");
    expect(xml).toContain("<category>Food</category>");
    expect(xml).toContain("Sun, 01 Nov 2026 00:00:00 GMT");
  });
});
