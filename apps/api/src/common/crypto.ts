import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

/** `bytes` of CSPRNG output as base64url (32 bytes → 43 chars, 256 bits). */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** SHA-256 as 64 hex chars. For high-entropy secrets (tokens, codes) only — never passwords. */
export const sha256Hex = (value: string) => createHash("sha256").update(value).digest("hex");

/** Constant-time string equality (no early exit on the first differing byte). */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** A separate 256-bit key per purpose, derived from one root secret, so one use can't forge another. */
function deriveKey(secret: string, purpose: string): Buffer {
  return Buffer.from(hkdfSync("sha256", secret, "fitlens", purpose, 32));
}

const IV_BYTES = 12;
const TAG_BYTES = 16;

/**
 * Encrypts and authenticates a JSON payload with AES-256-GCM, with an expiry inside the ciphertext.
 * The result is opaque to the client and can't be read, altered or moved to another `purpose`.
 */
export function seal(
  secret: string,
  purpose: string,
  payload: object,
  ttlMs: number,
  now = Date.now(),
): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", deriveKey(secret, purpose), iv);
  const plain = Buffer.from(JSON.stringify({ p: payload, exp: now + ttlMs }));
  const body = Buffer.concat([cipher.update(plain), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

export type UnsealResult<T> =
  { ok: true; payload: T } | { ok: false; reason: "invalid" | "expired" };

export function unseal<T>(
  secret: string,
  purpose: string,
  sealed: string,
  now = Date.now(),
): UnsealResult<T> {
  const raw = Buffer.from(sealed, "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) return { ok: false, reason: "invalid" };
  let parsed: { p: T; exp: number };
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      deriveKey(secret, purpose),
      raw.subarray(0, IV_BYTES),
    );
    decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
    const plain = Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]);
    parsed = JSON.parse(plain.toString());
  } catch {
    return { ok: false, reason: "invalid" };
  }
  if (typeof parsed.exp !== "number" || now > parsed.exp) return { ok: false, reason: "expired" };
  return { ok: true, payload: parsed.p };
}
