import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";
import { AppError } from "../../common/errors.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { AuthCookies } from "./auth.cookies.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * Cross-site request forgery defence for cookie sessions (SameSite=Lax is the first layer).
 *
 * A state-changing request that carries the session cookie must come from one of our origins.
 * Browsers say where a request came from in `Sec-Fetch-Site` and `Origin`, which pages can't forge.
 * Requests without either aren't from a browser, so they can't be riding a victim's cookie.
 * Bearer-token requests (the app) are exempt: another site can't make a browser attach that header.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  private readonly trusted: Set<string>;

  constructor(
    private readonly cookies: AuthCookies,
    @InjectEnv() env: Env,
  ) {
    this.trusted = new Set([new URL(env.PUBLIC_URL).origin, ...env.CORS_ORIGINS]);
  }

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (SAFE_METHODS.has(req.method)) return true;
    if (/^Bearer\s/i.test(req.headers.authorization ?? "")) return true;
    if (!this.cookies.hasSessionCookie(req)) return true;
    if (isAllowedOrigin(req, this.trusted)) return true;
    throw new AppError(403, "This request came from another site and was blocked");
  }
}

/** Exported for unit tests. Mirrors Go's net/http CrossOriginProtection. */
export function isAllowedOrigin(
  req: Pick<Request, "headers">,
  trusted: ReadonlySet<string>,
): boolean {
  const origin = req.headers.origin;
  if (origin && trusted.has(origin)) return true;
  const site = req.headers["sec-fetch-site"];
  if (site) return site === "same-origin" || site === "none";
  // No Fetch Metadata (older browser or not a browser): fall back to Origin, if any.
  return !origin;
}
