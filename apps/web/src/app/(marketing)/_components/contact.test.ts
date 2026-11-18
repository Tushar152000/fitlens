import { describe, expect, it } from "vitest";
import { validateContact } from "./contact";

const ok = { name: "Asha", email: "asha@example.com", message: "How do I change my goal?" };

describe("validateContact", () => {
  it("passes a complete message", () => {
    expect(validateContact(ok)).toEqual({});
  });

  it("flags a blank name, a bad email and a too-short message with the schema's wording", () => {
    expect(validateContact({ name: "  ", email: "asha@", message: "hi" })).toEqual({
      name: "Tell us your name.",
      email: "Enter an email we can reply to.",
      message: "Write a little more so we can help.",
    });
  });

  it("asks for a shorter message past the limit", () => {
    expect(validateContact({ ...ok, message: "x".repeat(2001) }).message).toBe(
      "That’s a bit long; please shorten it.",
    );
  });
});
