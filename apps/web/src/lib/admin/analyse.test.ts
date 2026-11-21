import { describe, expect, it } from "vitest";
import { analyseHtml, htmlText } from "./analyse";

describe("analyseHtml", () => {
  it("finds subheadings, alt-less images and links", () => {
    const html =
      `<h2>Why <em>protein</em> &amp; you</h2><h3>Tips</h3><h4>Ignored</h4>` +
      `<img src="a.jpg" alt="Dal"><img src="b.jpg"><img src="c.jpg" alt=" ">` +
      `<a href="/blog/x">a</a><a href="https://www.fitr8.com/plan">b</a><a href="https://pubmed.gov/1">c</a>` +
      `<a href="#top">d</a><a href="mailto:x@y.com">e</a><a href="not a url">f</a>`;
    expect(analyseHtml(html, ["www.fitr8.com"])).toEqual({
      headings: ["Why protein & you", "Tips"],
      imagesWithoutAlt: 2,
      internalLinks: 2,
      externalLinks: 1,
    });
  });

  it("handles empty input", () => {
    expect(analyseHtml("", [])).toEqual({
      headings: [],
      imagesWithoutAlt: 0,
      internalLinks: 0,
      externalLinks: 0,
    });
  });
});

describe("htmlText", () => {
  it("keeps words apart across blocks", () => {
    expect(htmlText("<p>one</p><p>two&nbsp;three</p><ul><li>four</li></ul>")).toBe(
      "one two three four",
    );
  });
});
