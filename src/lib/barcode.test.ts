import { describe, expect, it } from "vitest";
import { normalizeBarcode, upcEToUpcA } from "./barcode";

describe("barcodes", () => {
  it("accepts valid EAN-13 (Parle-G) and rejects a bad check digit", () => {
    expect(normalizeBarcode("8901719110023")).toBe("8901719110023");
    expect(normalizeBarcode("8901719110024")).toBeNull();
  });

  it("accepts EAN-8 and UPC-A, ignoring spaces", () => {
    expect(normalizeBarcode("9638 5074")).toBe("96385074");
    expect(normalizeBarcode("036000291452")).toBe("036000291452");
  });

  it("expands UPC-E to UPC-A", () => {
    expect(upcEToUpcA("04252614")).toBe("042100005264");
    expect(normalizeBarcode("04252614")).toBe("042100005264");
  });

  it("rejects other lengths", () => {
    expect(normalizeBarcode("12345")).toBeNull();
    expect(normalizeBarcode("")).toBeNull();
  });
});
