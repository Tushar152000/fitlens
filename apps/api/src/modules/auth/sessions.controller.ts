import {
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Req,
  Res,
  UseInterceptors,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { SessionDto } from "@fitr8/contracts";
import { CurrentAuth, type RequestAuth } from "../../common/auth/decorators.js";
import { NoStoreInterceptor } from "../../common/http/no-store.interceptor.js";
import { AuthCookies } from "./auth.cookies.js";
import { AuthService } from "./auth.service.js";
import { SessionService, clientMeta } from "./session.service.js";

/** The signed-in user's devices: list them, sign one out, or sign out everywhere. Same for web and app. */
@UseInterceptors(NoStoreInterceptor)
@Controller("auth")
export class SessionsController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
    private readonly cookies: AuthCookies,
  ) {}

  @Get("sessions")
  list(@CurrentAuth() auth: RequestAuth): Promise<SessionDto[]> {
    return this.sessions.list(auth.userId, auth.sessionId);
  }

  /** 404 for a session that isn't the caller's. Revoking the current one signs this client out. */
  @Delete("sessions/:id")
  @HttpCode(204)
  async revoke(
    @CurrentAuth() auth: RequestAuth,
    @Param("id") id: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const wasCurrent = await this.auth.revokeSession(auth, id, clientMeta(req));
    if (wasCurrent) this.cookies.clearSession(res);
  }

  @Post("signout-all")
  @HttpCode(204)
  async signOutEverywhere(
    @CurrentAuth() auth: RequestAuth,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.signOutEverywhere(auth, clientMeta(req));
    this.cookies.clearSession(res);
  }
}
