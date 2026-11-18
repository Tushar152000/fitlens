/** Copied from the web app (src/lib/barcode.ts). Keep the two in step. */
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

/**
 * Auto-open needs a clear vote: within the last READ_WINDOW_MS the same code read READS_TO_OPEN times
 * (8-digit codes one more, since a partial read of a 13-digit pack can pass as one) and at least
 * 3 reads for every read of any other code. A blurry frame can misread once or twice, even with a
 * valid check digit; it rarely wins a vote like this.
 */
const READS_TO_OPEN = 3;
export const READ_WINDOW_MS = 1500;

export type Read = { code: string; at: number };

/** [code, reads] pairs, most-read first; on a tie the longer code first. */
function rank(reads: Read[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const r of reads) counts.set(r.code, (counts.get(r.code) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length);
}

/** The code to open from recent reads, or null while the vote isn't clear yet. */
export function decideRead(reads: Read[]): string | null {
  const ranked = rank(reads);
  const [top, others] = [ranked[0], ranked.slice(1)];
  if (!top) return null;
  const [code, n] = top;
  const need = code.length === 8 ? READS_TO_OPEN + 1 : READS_TO_OPEN;
  const rest = others.reduce((sum, [, k]) => sum + k, 0);
  // A longer code also in view: the short one is likely a partial read of it.
  if (code.length === 8 && others.some(([c]) => c.length > 8)) return null;
  return n >= need && n >= rest * 3 ? code : null;
}

/** The most-read code so far (longer codes win ties), for the "Barcode found" hint and the shutter. */
export function leadingRead(reads: Read[]): string | null {
  return rank(reads)[0]?.[0] ?? null;
}
