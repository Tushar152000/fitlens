import { describe, expect, it } from "vitest";
import {
  flagEmoji,
  formatPhone,
  normalizePhone,
  personProblems,
  PHONE_COUNTRIES,
  phoneToE164,
  splitName,
  splitPhone,
} from "./person.js";

describe("normalizePhone", () => {
  it("takes a bare 10-digit mobile number as Indian", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210");
    expect(normalizePhone(" 98765 43210 ")).toBe("+919876543210");
    expect(normalizePhone("98765-43210")).toBe("+919876543210");
  });

  it("drops a leading 0 trunk prefix on an Indian number", () => {
    expect(normalizePhone("09876543210")).toBe("+919876543210");
  });

  it("keeps numbers that carry a country code", () => {
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210");
    expect(normalizePhone("+1 (415) 555-0132")).toBe("+14155550132");
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("0044 20 7946 0958")).toBe("+442079460958");
  });

  it("accepts 8 to 15 digits after the +", () => {
    expect(normalizePhone("+12345678")).toBe("+12345678");
    expect(normalizePhone("+123456789012345")).toBe("+123456789012345");
    expect(normalizePhone("+1234567")).toBeNull();
    expect(normalizePhone("+1234567890123456")).toBeNull();
  });

  it("rejects a country code starting with 0", () => {
    expect(normalizePhone("+0123456789")).toBeNull();
  });

  it("rejects local numbers that aren't Indian mobiles", () => {
    expect(normalizePhone("5876543210")).toBeNull(); // Indian mobiles start 6–9
    expect(normalizePhone("98765432")).toBeNull();
    expect(normalizePhone("987654321012")).toBeNull();
  });

  it("rejects letters, empty input and a misplaced +", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    expect(normalizePhone("98765abcde")).toBeNull();
    expect(normalizePhone("98765+43210")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups Indian numbers 5 + 5", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210");
  });

  it("leaves other countries as stored", () => {
    expect(formatPhone("+14155550132")).toBe("+14155550132");
  });
});

describe("personProblems", () => {
  const ok = { name: "Asha", lastName: "Rao", phoneCountry: "IN", phone: "" };

  it("passes with both names and no phone", () => {
    expect(personProblems(ok)).toEqual({});
  });

  it("requires first and last name", () => {
    expect(personProblems({ ...ok, name: "  ", lastName: "" })).toEqual({
      name: "Tell us what to call you",
      lastName: "Add your last name",
    });
  });

  it("caps both names at 60 characters", () => {
    expect(personProblems({ ...ok, name: "x".repeat(61), lastName: "y".repeat(61) })).toEqual({
      name: "Keep it under 60 characters",
      lastName: "Keep it under 60 characters",
    });
    expect(personProblems({ ...ok, name: "x".repeat(60), lastName: "y".repeat(60) })).toEqual({});
  });

  it("checks the phone only when one is typed", () => {
    expect(personProblems({ ...ok, phone: "98765 43210" })).toEqual({});
    expect(personProblems({ ...ok, phone: "12345" })).toEqual({
      phone: "Enter a valid phone number for the country you picked",
    });
  });

  it("checks the phone against the picked country", () => {
    expect(personProblems({ ...ok, phoneCountry: "GB", phone: "20 7946 0958" })).toEqual({});
    expect(
      personProblems({ ...ok, phoneCountry: "IN", phone: "20 7946 0958" }).phone,
    ).toBeDefined();
  });
});

describe("splitName", () => {
  it("keeps a saved last name", () => {
    expect(splitName("Asha", "Rao")).toEqual({ name: "Asha", lastName: "Rao" });
  });

  it("splits a full name from Google when there's no last name yet", () => {
    expect(splitName("Asha Rao", null)).toEqual({ name: "Asha", lastName: "Rao" });
    expect(splitName("  Mary  Ann Souza ", "")).toEqual({ name: "Mary Ann", lastName: "Souza" });
  });

  it("leaves a single name as the first name", () => {
    expect(splitName("Asha", null)).toEqual({ name: "Asha", lastName: "" });
  });

  it("handles no name at all", () => {
    expect(splitName(null, undefined)).toEqual({ name: "", lastName: "" });
  });
});

describe("phoneToE164", () => {
  it("needs a 10-digit mobile for India, dropping a leading 0", () => {
    expect(phoneToE164("IN", "98765 43210")).toBe("+919876543210");
    expect(phoneToE164("IN", "098765-43210")).toBe("+919876543210");
    expect(phoneToE164("IN", "5876543210")).toBeNull();
    expect(phoneToE164("IN", "987654321")).toBeNull();
  });

  it("prefixes the picked country's calling code elsewhere", () => {
    expect(phoneToE164("GB", "020 7946 0958")).toBe("+442079460958");
    expect(phoneToE164("US", "(415) 555-0132")).toBe("+14155550132");
    expect(phoneToE164("AE", "50 123 4567")).toBe("+971501234567");
  });

  it("rejects too short, too long and non-digits", () => {
    expect(phoneToE164("GB", "123")).toBeNull();
    expect(phoneToE164("US", "1234567890123456")).toBeNull();
    expect(phoneToE164("GB", "phone")).toBeNull();
  });

  it("lets a number typed with its own + win over the picker", () => {
    expect(phoneToE164("IN", "+44 20 7946 0958")).toBe("+442079460958");
    expect(phoneToE164("IN", "0044 20 7946 0958")).toBe("+442079460958");
  });

  it("falls back to India for an unknown country code", () => {
    expect(phoneToE164("XX", "9876543210")).toBe("+919876543210");
  });
});

describe("splitPhone", () => {
  it("finds the country and national number", () => {
    expect(splitPhone("+919876543210")).toEqual({ country: "IN", national: "9876543210" });
    expect(splitPhone("+971501234567")).toEqual({ country: "AE", national: "501234567" });
    expect(splitPhone("+442079460958")).toEqual({ country: "GB", national: "2079460958" });
  });

  it("prefers the longest calling code", () => {
    // Three-digit codes such as +973 (Bahrain) and +880 (Bangladesh).
    expect(splitPhone("+97312345678")).toEqual({ country: "BH", national: "12345678" });
    expect(splitPhone("+8801712345678")).toEqual({ country: "BD", national: "1712345678" });
  });

  it("puts +1 numbers under the United States", () => {
    expect(splitPhone("+14155550132")).toEqual({ country: "US", national: "4155550132" });
  });

  it("defaults to India with no number, and keeps unknown codes whole", () => {
    expect(splitPhone(null)).toEqual({ country: "IN", national: "" });
    expect(splitPhone("+5511912345678")).toEqual({ country: "IN", national: "+5511912345678" });
  });

  it("round-trips with phoneToE164", () => {
    for (const n of ["+919876543210", "+442079460958", "+14155550132", "+6591234567"]) {
      const { country, national } = splitPhone(n);
      expect(phoneToE164(country, national)).toBe(n);
    }
  });
});

describe("PHONE_COUNTRIES", () => {
  it("starts with India and has unique ISO codes", () => {
    expect(PHONE_COUNTRIES[0]?.iso).toBe("IN");
    const isos = PHONE_COUNTRIES.map((c) => c.iso);
    expect(new Set(isos).size).toBe(isos.length);
  });

  it("makes flag emoji from ISO codes", () => {
    expect(flagEmoji("IN")).toBe("🇮🇳");
    expect(flagEmoji("gb")).toBe("🇬🇧");
  });
});
