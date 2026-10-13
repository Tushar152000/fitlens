import { Injectable } from "@nestjs/common";
import type { CookieOptions, Request, Response } from "express";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { SIGN_IN_TTL_MS } from "./auth.policy.js";

/** Where the request's session token came from. Only cookie-borne sessions need CSRF protection. */
export type TokenSource = "cookie" | "bearer";

/**
 * Every cookie the API sets. Over https the names carry browser-enforced prefixes:
 * `__Host-` (Secure, Path=/, no Domain: can't be set or shadowed by a sibling subdomain) for the
 * session, `__Secure-` for the short-lived sign-in state, which is scoped to /api/auth.
 */
@Injectable()
export class AuthCookies {
  private readonly secure: boolean;
  readonly sessionName: string;
  readonly stateName: string;

  constructor(@InjectEnv() env: Env) {
    this.secure = env.PUBLIC_URL.startsWith("https://");
    this.sessionName = this.secure ? "__Host-fitlens_session" : "fitlens_session";
    this.stateName = this.secure ? "__Secure-fitlens_signin" : "fitlens_signin";
  }

  private base(path: string): CookieOptions {
    return { httpOnly: true, secure: this.secure, sameSite: "lax", path };
  }

  /** `Authorization: Bearer` (the app) wins over the cookie (the browser). */
  sessionToken(req: Request): { token: string; source: TokenSource } | null {
    const bearer = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (bearer) return { token: bearer, source: "bearer" };
    const cookie = this.read(req, this.sessionName);
    return cookie ? { token: cookie, source: "cookie" } : null;
  }

  hasSessionCookie(req: Request): boolean {
    return Boolean(this.read(req, this.sessionName));
  }

  /**
   * The cookie lives until the session's hard limit; the server enforces the shorter, sliding idle
   * expiry. So an active user's cookie never needs re-issuing on ordinary requests.
   */
  setSession(res: Response, token: string, absoluteExpiresAt: Date) {
    res.cookie(this.sessionName, token, { ...this.base("/"), expires: absoluteExpiresAt });
  }

  clearSession(res: Response) {
    res.clearCookie(this.sessionName, this.base("/"));
  }

  /** Sealed sign-in state for the Google round trip. Lax still sends it on Google's top-level redirect back. */
  setSignInState(res: Response, sealed: string) {
    res.cookie(this.stateName, sealed, { ...this.base("/api/auth"), maxAge: SIGN_IN_TTL_MS });
  }

  signInState(req: Request): string | null {
    return this.read(req, this.stateName);
  }

  clearSignInState(res: Response) {
    res.clearCookie(this.stateName, this.base("/api/auth"));
  }

  private read(req: Request, name: string): string | null {
    const value = (req.cookies as Record<string, unknown> | undefined)?.[name];
    return typeof value === "string" && value ? value : null;
  }
}
