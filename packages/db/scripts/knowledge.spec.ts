import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseNote } from "./knowledge.js";

const dir = new URL("../prisma/data/knowledge/", import.meta.url);

describe("knowledge notes", () => {
  it("parses front matter, sources and body", () => {
    const note = parseNote(
      "protein-needs",
      "---\ntitle: Protein\ntopic: nutrition\nkeywords: protein, muscle\nreviewed: true\nsources:\n- Source A\n- Source B\n---\n\nEat enough protein spread over the day, around 1.6 g/kg for muscle gain.\n",
    );
    expect(note).toMatchObject({
      slug: "protein-needs",
      title: "Protein",
      topic: "nutrition",
      keywords: "protein, muscle",
      sources: ["Source A", "Source B"],
      reviewed: true,
    });
    expect(note.body).toMatch(/^Eat enough/);
  });

  it("rejects notes without sources or with an unknown topic", () => {
    const body = "\n\nA body that is long enough to pass the minimum length check here.\n";
    expect(() => parseNote("a", `---\ntitle: A\ntopic: nutrition\n---${body}`)).toThrow(/source/);
    expect(() =>
      parseNote("a", `---\ntitle: A\ntopic: astrology\nsources:\n- X\n---${body}`),
    ).toThrow(/topic/);
  });

  it("every note in the repo is valid", () => {
    const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
    expect(files.length).toBeGreaterThanOrEqual(30);
    for (const f of files) {
      const note = parseNote(f.replace(/\.md$/, ""), readFileSync(new URL(f, dir), "utf8"));
      expect(note.sources.length).toBeGreaterThan(0);
    }
  });
});
