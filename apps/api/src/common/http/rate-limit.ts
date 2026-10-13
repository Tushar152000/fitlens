import { SetMetadata, type ExecutionContext } from "@nestjs/common";

const STRICT_RATE_LIMIT = "fitlens:strictRateLimit";

/**
 * Routes attackers like to hammer (sign-in). The global throttler gives them AUTH_RATE_LIMIT
 * requests per minute per IP instead of the default budget. Class or handler level.
 */
export const StrictRateLimit = () => SetMetadata(STRICT_RATE_LIMIT, true);

export const isStrictRateLimited = (ctx: ExecutionContext): boolean =>
  Boolean(
    Reflect.getMetadata(STRICT_RATE_LIMIT, ctx.getHandler()) ??
    Reflect.getMetadata(STRICT_RATE_LIMIT, ctx.getClass()),
  );
