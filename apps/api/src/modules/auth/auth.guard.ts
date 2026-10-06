import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { Response } from "express";
import { IS_PUBLIC, type AuthedRequest } from "../../common/auth/decorators.js";
import { AppError } from "../../common/errors.js";
import { AuthCookies } from "./auth.cookies.js";
import { SessionService } from "./session.service.js";

/**
 * Global guard: every route needs a live session (cookie on web, bearer token in the app) unless
 * @Public(). Sets `req.auth` for @UserId() / @CurrentAuth().
 */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
    private readonly cookies: AuthCookies,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const found = this.cookies.sessionToken(req);
    const auth = found ? await this.sessions.authenticate(found.token) : null;
    if (!auth) {
      // A dead cookie would be sent on every request; drop it.
      if (found?.source === "cookie")
        this.cookies.clearSession(ctx.switchToHttp().getResponse<Response>());
      throw new AppError(401, "Not signed in");
    }
    req.auth = auth;
    return true;
  }
}
