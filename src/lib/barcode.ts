/** GS1 retail barcodes: EAN-13, EAN-8, UPC-A (12) and UPC-E (8). */

/** GS1 mod-10 check: weights 3,1 from the right, excluding the check digit. */
function gs1Valid(code: string): boolean {
  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  digits.reverse().forEach((d, i) => (sum += d * (i % 2 === 0 ? 3 : 1)));
  return (10 - (sum % 10)) % 10 === check;
}

/** UPC-E (8 digits, number system 0/1) → UPC-A (12 digits). */
export function upcEToUpcA(upce: string): string | null {
  if (!/^[01]\d{7}$/.test(upce)) return null;
  const [ns, d1, d2, d3, d4, d5, d6, check] = upce.split("");
  let body: string;
  if ("012".includes(d6)) body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  return `${ns}${body}${check}`;
}

/**
 * Digits only, and a valid check digit for one of the four retail formats; null otherwise.
 * UPC-E codes are returned expanded to UPC-A, since that's how product databases store them.
 */
export function normalizeBarcode(raw: string): string | null {
  const code = raw.replace(/\D/g, "");
  if (code.length === 13 || code.length === 12) return gs1Valid(code) ? code : null;
  if (code.length === 8) {
    if (gs1Valid(code)) return code; // EAN-8
    const upca = upcEToUpcA(code);
    return upca && gs1Valid(upca) ? upca : null;
  }
  return null;
}
