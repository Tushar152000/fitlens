import { Injectable, type CanActivate, type ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AppError } from "../errors.js";
import { SessionService } from "../../modules/auth/session.service.js";
import { IS_PUBLIC, type AuthedRequest } from "./decorators.js";

/** Global guard: every route needs a valid session (cookie on web, bearer token on mobile) unless @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly sessions: SessionService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);
    if (isPublic) return true;
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token = this.sessions.tokenFrom(req);
    const userId = token ? await this.sessions.resolve(token) : null;
    if (!token || !userId) throw new AppError(401, "Not signed in");
    req.userId = userId;
    req.sessionToken = token;
    return true;
  }
}
