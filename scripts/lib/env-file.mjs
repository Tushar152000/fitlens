// Small, dependency-free helpers for reading and editing .env files without losing comments or order.
import { randomBytes } from "node:crypto";

const LINE = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)?\s*$/;

/** Parses KEY=value lines (quotes stripped, comments and blanks ignored). Later keys win. */
export function parseEnv(text) {
  const out = new Map();
  for (const raw of text.split(/\r?\n/)) {
    const m = LINE.exec(raw);
    if (!m) continue;
    let value = (m[2] ?? "").trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, "");
    }
    out.set(m[1], value);
  }
  return out;
}

/** Sets KEY in place if present (keeping its line position), else appends it. Values are double-quoted. */
export function setEnv(text, key, value) {
  const line = `${key}="${String(value).replace(/"/g, '\\"')}"`;
  const lines = text.split(/\r?\n/);
  let found = false;
  const next = lines.map((raw) => {
    const m = LINE.exec(raw);
    if (m && m[1] === key) {
      if (found) return null; // drop duplicates: one source of truth
      found = true;
      return line;
    }
    return raw;
  });
  const kept = next.filter((l) => l !== null);
  if (found) return kept.join("\n");
  const body = kept.join("\n").replace(/\n*$/, "");
  return `${body}${body ? "\n" : ""}${line}\n`;
}

/** Removes KEY entirely. */
export function unsetEnv(text, key) {
  return text
    .split(/\r?\n/)
    .filter((raw) => LINE.exec(raw)?.[1] !== key)
    .join("\n");
}

/** A 264-bit secret, the same strength as `openssl rand -base64 33`. */
export const generateSecret = () => randomBytes(33).toString("base64");

/** Replaces the port of a URL that points at this machine; other hosts are left alone. */
export function withLocalPort(url, port) {
  try {
    const u = new URL(url);
    if (!["localhost", "127.0.0.1", "0.0.0.0"].includes(u.hostname)) return url;
    u.port = String(port);
    return u.href.replace(/\/$/, url.endsWith("/") ? "/" : "");
  } catch {
    return url;
  }
}

/** True when a URL points at this machine (so the local Docker services apply). */
export function isLocalUrl(url) {
  try {
    return ["localhost", "127.0.0.1", "0.0.0.0"].includes(new URL(url).hostname);
  } catch {
    return false;
  }
}
