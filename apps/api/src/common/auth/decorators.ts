import { createParamDecorator, SetMetadata, type ExecutionContext } from "@nestjs/common";
import type { Request } from "express";

export const IS_PUBLIC = "fitr8:isPublic";

/** Opt a route out of the global AuthGuard (health checks, the sign-in flow). Everything else requires sign-in. */
export const Public = () => SetMetadata(IS_PUBLIC, true);

/** Who is calling. Set by AuthGuard on every non-public route. */
export interface RequestAuth {
  userId: string;
  sessionId: string;
}

export interface AuthedRequest extends Request {
  auth: RequestAuth;
}

/** The signed-in user's id: `@UserId() userId: string`. */
export const UserId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().auth.userId,
);

/** The signed-in user and the session making the request: `@CurrentAuth() auth: RequestAuth`. */
export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest<AuthedRequest>().auth,
);
