import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const IS_PUBLIC = "fitlens:isPublic";

/** Opt a route out of the global AuthGuard (health checks, the OAuth flow). Everything else requires sign-in. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export interface AuthedRequest extends Request {
  userId: string;
  sessionToken: string;
}

/** The signed-in user's id, set by AuthGuard. `@UserId() userId: string` */
export const UserId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().userId;
});
