import { Controller, Get, HttpCode, Post, Req, Res, UseInterceptors } from "@nestjs/common";
import type { Request, Response } from "express";
import {
  AppleSignInSchema,
  DevLoginSchema,
  GoogleStartQuerySchema,
  MobileStartQuerySchema,
  MobileTokenSchema,
  type AppleSignInInput,
  type AuthTokenDto,
  type DevLoginDto,
  type DevLoginInput,
  type GoogleStartQuery,
  type MobileStartQuery,
  type MobileTokenInput,
  type ProvidersDto,
} from "@fitr8/contracts";
import { Public } from "../../common/auth/decorators.js";
import { NoStoreInterceptor } from "../../common/http/no-store.interceptor.js";
import { StrictRateLimit } from "../../common/http/rate-limit.js";
import { ZodBody, ZodQuery } from "../../common/http/zod.js";
import { AuthCookies } from "./auth.cookies.js";
import { AuthService, type CallbackQuery } from "./auth.service.js";
import { clientMeta } from "./session.service.js";

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/**
 * Signing in and out. Transport only: AuthService owns the flow; this class moves cookies, bodies
 * and redirects. Public (no session needed), rate limited per IP, never cached.
 */
@Public()
@StrictRateLimit()
@UseInterceptors(NoStoreInterceptor)
@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookies,
  ) {}

  /** Which sign-in buttons the login screen shows. */
  @Get("providers")
  providers(): ProvidersDto {
    return this.auth.providers();
  }

  /** Web: `<a href="/api/auth/google?returnTo=/today">` → Google → back to `returnTo`, signed in. */
  @Get("google")
  startGoogle(@ZodQuery(GoogleStartQuerySchema) query: GoogleStartQuery, @Res() res: Response) {
    const started = this.auth.startWeb(query.returnTo);
    this.cookies.setSignInState(res, started.state);
    res.redirect(started.location);
  }

  /**
   * App, step 1 (system browser): `?challenge=S256(verifier)&redirect=fitlens://auth` → Google →
   * `fitlens://auth?code=…` (or `?error=…`).
   */
  @Get("mobile/start")
  startMobile(@ZodQuery(MobileStartQuerySchema) query: MobileStartQuery, @Res() res: Response) {
    const started = this.auth.startMobile(query);
    this.cookies.setSignInState(res, started.state);
    res.redirect(started.location);
  }

  /** Google's redirect back, for both flows. The path is the redirect URI registered with Google. */
  @Get("callback/google")
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const query: CallbackQuery = {
      code: str(req.query.code),
      state: str(req.query.state),
      error: str(req.query.error),
    };
    const sealedState = this.cookies.signInState(req);
    this.cookies.clearSignInState(res);
    const existing = this.cookies.sessionToken(req);
    const outcome = await this.auth.completeGoogle(
      query,
      sealedState,
      existing?.source === "cookie" ? existing.token : null,
      clientMeta(req),
    );
    if (outcome.kind === "web") {
      this.cookies.setSession(res, outcome.session.token, outcome.session.absoluteExpiresAt);
    }
    res.redirect(outcome.location);
  }

  /** App, step 2: the one-time code + PKCE verifier → a bearer session token. */
  @Post("mobile/token")
  @HttpCode(200)
  token(
    @ZodBody(MobileTokenSchema) body: MobileTokenInput,
    @Req() req: Request,
  ): Promise<AuthTokenDto> {
    return this.auth.redeemAppCode(body, clientMeta(req));
  }

  /** App (iOS): Sign in with Apple's identity token + raw nonce → a bearer session token. */
  @Post("apple")
  @HttpCode(200)
  apple(
    @ZodBody(AppleSignInSchema) body: AppleSignInInput,
    @Req() req: Request,
  ): Promise<AuthTokenDto> {
    return this.auth.signInWithApple(body, clientMeta(req));
  }

  /** Ends this session (cookie or bearer). Always 204, signed in or not, and clears the cookie. */
  @Post("signout")
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const found = this.cookies.sessionToken(req);
    await this.auth.signOut(
      found?.token ?? null,
      found?.source === "bearer" ? "MOBILE" : "WEB",
      clientMeta(req),
    );
    this.cookies.clearSession(res);
  }

  /** Local development and tests: sign in by email. Sets the web cookie and returns the same session's token. */
  @Post("dev")
  @HttpCode(200)
  async devLogin(
    @ZodBody(DevLoginSchema) body: DevLoginInput,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DevLoginDto> {
    const { userId, session } = await this.auth.devLogin(body, clientMeta(req));
    this.cookies.setSession(res, session.token, session.absoluteExpiresAt);
    return { userId, token: session.token, expiresAt: session.expiresAt.toISOString() };
  }
}
