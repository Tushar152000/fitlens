import { describe, expect, it } from "vitest";
import { isAllowedOrigin } from "./origin.guard.js";

const trusted = new Set(["https://fitlens.app", "http://localhost:8081"]);
const req = (headers: Record<string, string>) => ({ headers });

describe("isAllowedOrigin", () => {
  it("allows our own pages", () => {
    expect(isAllowedOrigin(req({ "sec-fetch-site": "same-origin" }), trusted)).toBe(true);
    expect(isAllowedOrigin(req({ origin: "https://fitlens.app" }), trusted)).toBe(true);
    expect(
      isAllowedOrigin(
        req({ origin: "http://localhost:8081", "sec-fetch-site": "same-site" }),
        trusted,
      ),
    ).toBe(true);
    // Typed into the address bar / opened from a bookmark.
    expect(isAllowedOrigin(req({ "sec-fetch-site": "none" }), trusted)).toBe(true);
  });

  it("allows non-browser clients, which can't carry a victim's cookie", () => {
    expect(isAllowedOrigin(req({}), trusted)).toBe(true);
  });

  it("blocks other sites, including sibling subdomains", () => {
    expect(
      isAllowedOrigin(
        req({ origin: "https://evil.example", "sec-fetch-site": "cross-site" }),
        trusted,
      ),
    ).toBe(false);
    expect(
      isAllowedOrigin(
        req({ origin: "https://x.fitlens.app", "sec-fetch-site": "same-site" }),
        trusted,
      ),
    ).toBe(false);
    expect(isAllowedOrigin(req({ origin: "https://evil.example" }), trusted)).toBe(false);
    expect(isAllowedOrigin(req({ origin: "null" }), trusted)).toBe(false);
  });
});
