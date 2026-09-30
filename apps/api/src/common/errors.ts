/**
 * An expected failure with an HTTP status. Services throw it; the global filter turns it into
 * `{ error, details }` JSON. Deliberately framework-free so domain services stay portable
 * (a service moved into its own microservice keeps throwing the same errors).
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const notFound = (what: string, details?: unknown) =>
  new AppError(404, `${what} not found`, details);
