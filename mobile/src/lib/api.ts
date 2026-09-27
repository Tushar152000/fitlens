import { API_URL } from "./config";

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setApiToken(value: string | null) {
  token = value;
}

/** Called once by the auth provider so a 401 anywhere signs the user out. */
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

type Options = { method?: string; json?: unknown; signal?: AbortSignal };

/** JSON call to the FitLens API with the bearer token. Throws ApiError with the server's message. */
export async function api<T = unknown>(path: string, { method, json, signal }: Options = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method: method ?? (json === undefined ? "GET" : "POST"),
      headers: {
        Accept: "application/json",
        ...(json === undefined ? {} : { "Content-Type": "application/json" }),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: json === undefined ? undefined : JSON.stringify(json),
      signal,
    });
  } catch {
    throw new ApiError(0, "No connection. Check your internet and try again.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && token) onUnauthorized?.();
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.details);
  }
  return body as T;
}

/** Plain-text download (e.g. the CSV export) with the bearer token. */
export async function apiText(path: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  } catch {
    throw new ApiError(0, "No connection. Check your internet and try again.");
  }
  if (!res.ok) throw new ApiError(res.status, `Request failed (${res.status})`);
  return res.text();
}
