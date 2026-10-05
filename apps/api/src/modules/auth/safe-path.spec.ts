import { describe, expect, it } from "vitest";
import { safePath } from "./safe-path.js";

describe("safePath", () => {
  it("keeps same-site paths", () => {
    expect(safePath("/welcome/done")).toBe("/welcome/done");
    expect(safePath("/log?meal=lunch")).toBe("/log?meal=lunch");
  });

  it("falls back to /today for anything that could leave the site", () => {
    for (const p of [
      "//evil.com",
      "/\\evil.com",
      "https://evil.com",
      "evil.com",
      "",
      undefined,
      42,
    ]) {
      expect(safePath(p)).toBe("/today");
    }
  });

  it("never resolves to another host", () => {
    for (const p of ["/a", "//evil.com", "/\\evil.com", "/\\/evil.com"]) {
      expect(new URL(safePath(p), "https://fitr8.example").host).toBe("fitr8.example");
    }
  });
});
