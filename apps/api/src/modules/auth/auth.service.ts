import { Injectable, Logger } from "@nestjs/common";
import type {
  AuthTokenDto,
  DevLoginInput,
  MobileStartQuery,
  MobileTokenInput,
  ProvidersDto,
  SessionClient,
} from "@fitlens/contracts";
import { Prisma } from "@fitlens/db";
import { randomToken, safeEqual, seal, sha256Hex, unseal } from "../../common/crypto.js";
import { AppError } from "../../common/errors.js";
import { InjectEnv, isDeployed, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import { AuthEventsService } from "./auth-events.service.js";
import {
  AUTH_CODE_TTL_MS,
  SIGN_IN_TTL_MS,
  isAllowedAppRedirect,
  pkceChallenge,
  pkceMatches,
  safeReturnPath,
} from "./auth.policy.js";
import { InjectGoogleOidc, OidcError, type OidcProvider } from "./google/oidc.js";
import { IdentityRejected, IdentityService } from "./identity.service.js";
import {
  SessionService,
  type AuthContext,
  type ClientMeta,
  type IssuedSession,
} from "./session.service.js";

/** HKDF purpose for the sign-in state cookie: its key can't open anything else. */
const STATE_PURPOSE = "signin-state";

/**
 * What survives the Google round trip, sealed (AES-GCM) in an httpOnly cookie:
 * `s` state (CSRF: must come back in the query), `v` our PKCE verifier for Google, `n` the OIDC
 * nonce, and where to go next — a web path, or the app's PKCE challenge and redirect.
 */
type SignInTarget =
  { kind: "web"; returnTo: string } | { kind: "mobile"; challenge: string; redirect: string };
type SignInState = { s: string; v: string; n: string } & SignInTarget;

export interface StartedSignIn {
  /** Value for the sign-in state cookie. */
  state: string;
  /** Google's consent page. */
  location: string;
}

export interface CallbackQuery {
  code?: string;
  state?: string;
  error?: string;
}

export type CallbackOutcome =
  /** Web sign-in done: set this session's cookie, then go to `location`. */
  | { kind: "web"; session: IssuedSession; location: string }
  /** App hand-off (with a code) or any failure (with an error): just go to `location`. */
  | { kind: "redirect"; location: string };

const COPY = {
  expired: "Sign-in expired, try again",
  cancelled: "Sign-in was cancelled",
  google: "Google sign-in failed, try again",
  unverified: "Your Google email isn't verified yet. Verify it with Google, then try again.",
  taken: "This email is already linked to a different Google account",
  badCode: "Bad sign-in code",
  expiredCode: "Sign-in code expired, try again",
} as const;

class SignInFailure extends Error {
  constructor(
    public readonly reason: string,
    public readonly copy: string,
  ) {
    super(reason);
  }
}

/**
 * Sign-in use cases for every client. Web and app share the Google step; they differ only in how
 * the session reaches the client (cookie vs. a one-time code the app trades for a bearer token).
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectGoogleOidc() private readonly google: OidcProvider,
    private readonly identities: IdentityService,
    private readonly sessions: SessionService,
    private readonly events: AuthEventsService,
    private readonly users: UsersService,
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  private get deployed() {
    return isDeployed(this.env);
  }

  get devLoginEnabled(): boolean {
    return this.env.AUTH_DEV_LOGIN && !this.deployed;
  }

  /** Must match the "Authorized redirect URI" in the Google Cloud console. */
  get googleRedirectUri(): string {
    return new URL("/api/auth/callback/google", this.env.PUBLIC_URL).href;
  }

  providers(): ProvidersDto {
    return { google: this.google.enabled, dev: this.devLoginEnabled };
  }

  // ── Start ──────────────────────────────────────────────────────────────

  startWeb(returnTo: string | undefined): StartedSignIn {
    return this.start({ kind: "web", returnTo: safeReturnPath(returnTo, this.env.PUBLIC_URL) });
  }

  startMobile({ challenge, redirect }: MobileStartQuery): StartedSignIn {
    if (!isAllowedAppRedirect(redirect, this.deployed)) {
      throw new AppError(400, "Invalid sign-in request");
    }
    // Always through Google (no "already signed in on this browser" shortcut): a hostile app that
    // registered our URL scheme must never get a code without the user choosing an account.
    return this.start({ kind: "mobile", challenge, redirect });
  }

  private start(target: SignInTarget): StartedSignIn {
    if (!this.google.enabled) throw new AppError(503, "Google sign-in is not configured");
    const state: SignInState = { s: randomToken(), v: randomToken(), n: randomToken(), ...target };
    return {
      state: seal(this.env.AUTH_SECRET, STATE_PURPOSE, state, SIGN_IN_TTL_MS),
      location: this.google.authorizeUrl({
        redirectUri: this.googleRedirectUri,
        state: state.s,
        nonce: state.n,
        codeChallenge: pkceChallenge(state.v),
      }),
    };
  }

  // ── Callback ───────────────────────────────────────────────────────────

  /**
   * Google's redirect back. Never throws: every outcome is a redirect, to the app or the web app.
   * `previousWebToken` is the browser's existing session, replaced rather than left alive.
   */
  async completeGoogle(
    query: CallbackQuery,
    sealedState: string | null,
    previousWebToken: string | null,
    meta: ClientMeta,
  ): Promise<CallbackOutcome> {
    const opened = sealedState
      ? unseal<SignInState>(this.env.AUTH_SECRET, STATE_PURPOSE, sealedState)
      : null;
    const state = opened?.ok ? opened.payload : null;
    try {
      if (!state) {
        throw new SignInFailure(
          !opened ? "state_missing" : opened.ok ? "state_invalid" : `state_${opened.reason}`,
          COPY.expired,
        );
      }
      if (!query.state || !safeEqual(query.state, state.s)) {
        throw new SignInFailure("state_mismatch", COPY.expired);
      }
      if (query.error) {
        throw new SignInFailure(
          query.error === "access_denied" ? "cancelled" : "provider_error",
          query.error === "access_denied" ? COPY.cancelled : COPY.google,
        );
      }
      if (!query.code) throw new SignInFailure("code_missing", COPY.google);

      const identity = await this.google.exchange({
        code: query.code,
        codeVerifier: state.v,
        redirectUri: this.googleRedirectUri,
      });
      if (!identity.nonce || !safeEqual(identity.nonce, state.n)) {
        throw new SignInFailure("nonce_mismatch", COPY.google);
      }
      const userId = await this.identities.resolveUser("GOOGLE", identity);

      if (state.kind === "mobile") {
        return { kind: "redirect", location: await this.issueAppCode(userId, state) };
      }
      if (previousWebToken) await this.sessions.revokeToken(previousWebToken);
      const session = await this.sessions.create(userId, "WEB", meta);
      await this.events.record({ type: "SIGN_IN", userId, client: "WEB", meta });
      return {
        kind: "web",
        session,
        location: new URL(state.returnTo, this.env.PUBLIC_URL).href,
      };
    } catch (err) {
      const failure = this.toFailure(err);
      await this.events.record({
        type: "SIGN_IN_FAILED",
        client: state ? (state.kind === "mobile" ? "MOBILE" : "WEB") : null,
        reason: failure.reason,
        meta,
      });
      return { kind: "redirect", location: this.failureLocation(state, failure.copy) };
    }
  }

  private toFailure(err: unknown): SignInFailure {
    if (err instanceof SignInFailure) return err;
    if (err instanceof OidcError) {
      this.logger.warn(`Google sign-in failed (${err.reason}): ${err.message}`);
      return new SignInFailure(err.reason, COPY.google);
    }
    if (err instanceof IdentityRejected) {
      return new SignInFailure(
        err.reason,
        err.reason === "email_taken" ? COPY.taken : COPY.unverified,
      );
    }
    this.logger.error(err instanceof Error ? (err.stack ?? err.message) : String(err));
    return new SignInFailure("internal_error", COPY.google);
  }

  /** The app's redirect when we know it (state opened), else the web login screen. */
  private failureLocation(state: SignInState | null, copy: string): string {
    const url =
      state?.kind === "mobile" ? new URL(state.redirect) : new URL("/login", this.env.PUBLIC_URL);
    url.searchParams.set("error", copy);
    return url.href;
  }

  // ── App hand-off ───────────────────────────────────────────────────────

  private async issueAppCode(
    userId: string,
    state: Extract<SignInState, { kind: "mobile" }>,
  ): Promise<string> {
    const code = randomToken();
    await this.prisma.authCode.create({
      data: {
        codeHash: sha256Hex(code),
        userId,
        challenge: state.challenge,
        redirectUri: state.redirect,
        expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
      },
    });
    const back = new URL(state.redirect);
    back.searchParams.set("code", code);
    return back.href;
  }

  /**
   * Trades the one-time code + PKCE verifier for an app session. The code is deleted before it's
   * checked, so it works once: a replay, or a second guess at the verifier, finds nothing.
   */
  async redeemAppCode(
    { code, verifier }: MobileTokenInput,
    meta: ClientMeta,
  ): Promise<AuthTokenDto> {
    let row: { userId: string; challenge: string; expiresAt: Date };
    try {
      row = await this.prisma.authCode.delete({
        where: { codeHash: sha256Hex(code) },
        select: { userId: true, challenge: true, expiresAt: true },
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
        await this.failMobile("code_unknown", meta);
        throw new AppError(400, COPY.badCode);
      }
      throw err;
    }
    if (row.expiresAt <= new Date()) {
      await this.failMobile("code_expired", meta, row.userId);
      throw new AppError(400, COPY.expiredCode);
    }
    if (!pkceMatches(verifier, row.challenge)) {
      await this.failMobile("pkce_mismatch", meta, row.userId);
      throw new AppError(400, COPY.badCode);
    }
    const session = await this.sessions.create(row.userId, "MOBILE", meta);
    await this.events.record({ type: "SIGN_IN", userId: row.userId, client: "MOBILE", meta });
    return { token: session.token, expiresAt: session.expiresAt.toISOString() };
  }

  private failMobile(reason: string, meta: ClientMeta, userId?: string) {
    return this.events.record({ type: "SIGN_IN_FAILED", userId, client: "MOBILE", reason, meta });
  }

  // ── Sign-out and devices ───────────────────────────────────────────────

  /** Ends the caller's session, if any. Idempotent: signing out twice is fine. */
  async signOut(token: string | null, client: SessionClient, meta: ClientMeta): Promise<void> {
    if (!token) return;
    const ended = await this.sessions.revokeToken(token);
    if (ended) await this.events.record({ type: "SIGN_OUT", userId: ended.userId, client, meta });
  }

  /** Signs the user out on every device, this one included. */
  async signOutEverywhere(auth: AuthContext, meta: ClientMeta): Promise<void> {
    await this.sessions.revokeAll(auth.userId);
    await this.events.record({ type: "SIGN_OUT_ALL", userId: auth.userId, meta });
  }

  /** Ends one of the caller's sessions. 404 when it isn't theirs. Returns whether it was this one. */
  async revokeSession(auth: AuthContext, sessionId: string, meta: ClientMeta): Promise<boolean> {
    if (!(await this.sessions.revokeById(auth.userId, sessionId))) {
      throw new AppError(404, "Session not found");
    }
    await this.events.record({
      type: "SESSION_REVOKED",
      userId: auth.userId,
      reason: sessionId === auth.sessionId ? "current" : null,
      meta,
    });
    return sessionId === auth.sessionId;
  }

  // ── Development ────────────────────────────────────────────────────────

  /** Local/test sign-in by email. 404 (not 403) when deployed, so it doesn't advertise itself. */
  async devLogin(
    { email, name }: DevLoginInput,
    meta: ClientMeta,
  ): Promise<{ userId: string; session: IssuedSession }> {
    if (!this.devLoginEnabled) throw new AppError(404, "Not found");
    const normalized = email.toLowerCase();
    let userId = await this.users.findIdByEmail(normalized);
    if (!userId) {
      try {
        userId = await this.users.create({
          email: normalized,
          name: name ?? normalized.split("@")[0]!,
          image: null,
          emailVerified: null,
        });
      } catch (err) {
        if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"))
          throw err;
        userId = (await this.users.findIdByEmail(normalized))!;
      }
    }
    const session = await this.sessions.create(userId, "WEB", meta);
    await this.events.record({ type: "SIGN_IN", userId, client: "WEB", reason: "dev", meta });
    return { userId, session };
  }
}
