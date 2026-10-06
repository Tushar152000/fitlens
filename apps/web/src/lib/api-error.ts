/** An error response from @fitr8/api: `{ error, details }` plus the HTTP status (0 = unreachable). */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    /** Extra data the server sent, e.g. scan usage on a 429. */
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}
