import { fetch as streamingFetch } from "expo/fetch";
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

const OFFLINE = "No connection. Check your internet and try again.";

const authHeader = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});

/** Turns a non-2xx response into an ApiError with the server's message; a 401 signs the user out. */
async function failFrom(res: { status: number; json(): Promise<unknown> }): Promise<never> {
  const body = ((await res.json().catch(() => ({}))) ?? {}) as { error?: string; details?: unknown };
  if (res.status === 401 && token) onUnauthorized?.();
  throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`, body.details);
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
        ...authHeader(),
      },
      body: json === undefined ? undefined : JSON.stringify(json),
      signal,
    });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  if (res.status === 204) return undefined as T;
  if (!res.ok) return failFrom(res);
  return res.json().catch(() => ({})) as Promise<T>;
}

/** Plain-text download (e.g. the CSV export) with the bearer token. */
export async function apiText(path: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { headers: authHeader() });
  } catch {
    throw new ApiError(0, OFFLINE);
  }
  if (!res.ok) return failFrom(res);
  return res.text();
}

/**
 * POST a JSON body and read a `text/event-stream` reply, calling `onEvent` with each `data:` JSON
 * object as it arrives. React Native's global fetch buffers the whole body, so this uses
 * `expo/fetch`, which exposes `response.body` as a ReadableStream (on web it is the browser fetch).
 * Resolves when the stream ends; an aborted `signal` rejects with the abort error untouched.
 */
export async function apiStream<E>(
  path: string,
  { json, signal, onEvent }: { json: unknown; signal?: AbortSignal; onEvent: (event: E) => void },
): Promise<void> {
  let res: Awaited<ReturnType<typeof streamingFetch>>;
  try {
    res = await streamingFetch(`${API_URL}${path}`, {
      method: "POST",
      headers: { Accept: "text/event-stream", "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify(json),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, OFFLINE);
  }
  if (!res.ok) return failFrom(res);
  if (!res.body) throw new ApiError(0, "The reply didn't come through. Try again.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer = drainEvents(buffer + decoder.decode(value, { stream: true }), onEvent);
    }
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new ApiError(0, "The connection dropped. Check your internet and try again.");
  }
  drainEvents(buffer + decoder.decode() + "\n\n", onEvent);
}

/** Emits every complete SSE event in `buffer` and returns the unfinished tail. */
function drainEvents<E>(buffer: string, onEvent: (event: E) => void): string {
  const blocks = buffer.replace(/\r\n?/g, "\n").split("\n\n");
  const tail = blocks.pop() ?? "";
  for (const block of blocks) {
    const data = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""))
      .join("\n");
    if (!data) continue; // comments / keep-alives
    try {
      onEvent(JSON.parse(data) as E);
    } catch {
      // A malformed event is skipped rather than ending the reply.
    }
  }
  return tail;
}
