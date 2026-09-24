/** An error with an HTTP status, turned into a JSON response by `route()` in lib/api. No framework imports, so the worker can use it. */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
