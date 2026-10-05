import { Body, Controller, Get, HttpCode, Post, Query, Req, Res } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import type { DevLoginDto, MobileTokenDto, ProvidersDto } from "@fitr8/contracts";
import { z } from "zod";
import { Public } from "../../common/auth/decorators.js";
import { signPayload, verifyPayload } from "../../common/crypto.js";
import { AppError } from "../../common/errors.js";
import { ZodPipe } from "../../common/http/zod.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { GoogleOAuthService } from "./google-oauth.service.js";
import { isAllowedRedirect, isChallenge, redeemCode, signCode } from "./mobile-handoff.js";
import { safePath } from "./safe-path.js";
import { MOBILE_SESSION_DAYS, SessionService } from "./session.service.js";

const STATE_COOKIE = "fitlens_oauth";
const STATE_TTL_MS = 10 * 60 * 1000;

interface OAuthState {
  /** Must equal the state cookie: binds the callback to the browser that started it (CSRF). */
  n: string;
  /** Web: where to land after sign-in (a same-site path). */
  r?: string;
  /** App hand-off: the PKCE challenge and the app redirect. */
  m?: { c: string; r: string };
}

const TokenBody = z.object({
  code: z.string().min(1).max(1000),
  verifier: z.string().min(43).max(128),
});
const DevLoginBody = z.object({ email: z.string().email(), name: z.string().max(80).optional() });

@Public()
@Controller()
export class AuthController {
  constructor(
    private readonly google: GoogleOAuthService,
    private readonly sessions: SessionService,
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  /** Web sign-in: `<a href="/api/auth/google?returnTo=/today">`. */
  @Get("auth/google")
  startGoogle(@Query("returnTo") returnTo: string | undefined, @Res() res: Response) {
    res.redirect(this.googleRedirect(res, { r: safePath(returnTo) }));
  }

  @Get("auth/callback/google")
  async googleCallback(@Req() req: Request, @Res() res: Response) {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const verified = state ? verifyPayload<OAuthState>(this.env.AUTH_SECRET, state) : null;
    const nonce = (req.cookies as Record<string, string | undefined>)[STATE_COOKIE];
    res.clearCookie(STATE_COOKIE, { path: "/api/auth" });

    const fail = (message: string) => {
      const url = new URL("/login", this.env.PUBLIC_URL);
      url.searchParams.set("error", message);
      res.redirect(url.href);
    };
    if (error) return fail("Sign-in was cancelled");
    if (!code || !verified?.ok || verified.payload.n !== nonce)
      return fail("Sign-in expired, try again");

    let userId: string;
    try {
      userId = await this.google.signIn(code);
    } catch (err) {
      return fail(err instanceof AppError ? err.message : "Google sign-in failed");
    }

    const { m, r } = verified.payload;
    if (m) {
      const back = new URL(m.r);
      back.searchParams.set("code", signCode(this.env.AUTH_SECRET, userId, m.c));
      return res.redirect(back.href);
    }
    await this.sessions.startWebSession(res, userId);
    res.redirect(new URL(safePath(r), this.env.PUBLIC_URL).href);
  }

  /** Web sign-out. */
  @Post("auth/signout")
  @HttpCode(204)
  async signOut(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = this.sessions.tokenFrom(req);
    if (token) await this.sessions.revoke(token);
    this.sessions.clearWebCookies(res);
  }

  /** Step 1 of the app hand-off, opened in the phone's browser (see mobile-handoff.ts). */
  @Get("mobile/start")
  async mobileStart(@Req() req: Request, @Res() res: Response) {
    const challenge = String(req.query.challenge ?? "");
    const redirect = String(req.query.redirect ?? "");
    if (!isChallenge(challenge) || !isAllowedRedirect(redirect)) {
      throw new AppError(400, "Invalid sign-in request");
    }
    // Already signed in on this browser: skip Google.
    const token = this.sessions.tokenFrom(req);
    const userId = token ? await this.sessions.resolve(token) : null;
    if (userId) {
      const back = new URL(redirect);
      back.searchParams.set("code", signCode(this.env.AUTH_SECRET, userId, challenge));
      return res.redirect(back.href);
    }
    res.redirect(this.googleRedirect(res, { m: { c: challenge, r: redirect } }));
  }

  /** Step 2 of the app hand-off: trades the code + PKCE verifier for a bearer token. */
  @Post("mobile/token")
  async mobileToken(
    @Body(new ZodPipe(TokenBody)) body: z.infer<typeof TokenBody>,
  ): Promise<MobileTokenDto> {
    const userId = redeemCode(this.env.AUTH_SECRET, body.code, body.verifier);
    const { token, expires } = await this.sessions.create(userId, MOBILE_SESSION_DAYS);
    return { token, expires: expires.toISOString() };
  }

  /** Ends the app's session: deletes the bearer token's row. */
  @Post("mobile/signout")
  @HttpCode(204)
  async mobileSignOut(@Req() req: Request) {
    const token = this.sessions.tokenFrom(req);
    if (token) await this.sessions.revoke(token);
  }

  /** Local development only: sign in by email without Google. Sets the web cookie and returns a bearer token. */
  @Post("auth/dev")
  async devLogin(
    @Body(new ZodPipe(DevLoginBody)) body: z.infer<typeof DevLoginBody>,
    @Res({ passthrough: true }) res: Response,
  ): Promise<DevLoginDto> {
    if (!this.env.AUTH_DEV_LOGIN || this.env.NODE_ENV === "production")
      throw new AppError(404, "Not found");
    const email = body.email.toLowerCase();
    const user = await this.prisma.user.upsert({
      where: { email },
      create: { email, name: body.name ?? email.split("@")[0] },
      update: {},
    });
    await this.sessions.startWebSession(res, user.id);
    const { token, expires } = await this.sessions.create(user.id, MOBILE_SESSION_DAYS);
    return { userId: user.id, token, expires: expires.toISOString() };
  }

  /** Which sign-in methods the login screen should offer. */
  @Get("auth/providers")
  providers(): ProvidersDto {
    return {
      google: this.google.enabled,
      dev: this.env.AUTH_DEV_LOGIN && this.env.NODE_ENV !== "production",
    };
  }

  private googleRedirect(res: Response, state: Omit<OAuthState, "n">): string {
    const n = randomBytes(16).toString("base64url");
    res.cookie(STATE_COOKIE, n, {
      httpOnly: true,
      secure: this.env.PUBLIC_URL.startsWith("https://"),
      sameSite: "lax",
      path: "/api/auth",
      maxAge: STATE_TTL_MS,
    });
    return this.google.authorizeUrl(
      signPayload(this.env.AUTH_SECRET, { ...state, n }, STATE_TTL_MS),
    );
  }
}
