import { Injectable } from "@nestjs/common";
import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

/** Web session cookie. The Auth.js names are still read so people signed in before the move stay signed in. */
export const SESSION_COOKIE = "fitlens_session";
const LEGACY_COOKIES = ["__Secure-authjs.session-token", "authjs.session-token"];
export const MOBILE_SESSION_DAYS = 90;

/**
 * Opaque, database-backed sessions (the `sessions` table). One mechanism for both clients:
 * web carries the token in an httpOnly cookie, the app in `Authorization: Bearer`.
 * Revocation is a row delete, which is why we don't use stateless JWTs here.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  tokenFrom(req: Request): string | null {
    const bearer = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i)?.[1];
    if (bearer) return bearer;
    const cookies = (req.cookies ?? {}) as Record<string, string | undefined>;
    for (const name of [SESSION_COOKIE, ...LEGACY_COOKIES]) {
      if (cookies[name]) return cookies[name]!;
    }
    return null;
  }

  async resolve(token: string): Promise<string | null> {
    const session = await this.prisma.session.findUnique({
      where: { sessionToken: token },
      select: { userId: true, expires: true },
    });
    return session && session.expires > new Date() ? session.userId : null;
  }

  async create(userId: string, days: number) {
    const sessionToken = randomBytes(32).toString("base64url");
    const expires = new Date(Date.now() + days * 86_400_000);
    await this.prisma.session.create({ data: { sessionToken, userId, expires } });
    return { token: sessionToken, expires };
  }

  async revoke(token: string) {
    await this.prisma.session.deleteMany({ where: { sessionToken: token } });
  }

  async startWebSession(res: Response, userId: string) {
    const { token, expires } = await this.create(userId, this.env.SESSION_DAYS);
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: this.env.PUBLIC_URL.startsWith("https://"),
      sameSite: "lax",
      path: "/",
      expires,
    });
  }

  clearWebCookies(res: Response) {
    for (const name of [SESSION_COOKIE, ...LEGACY_COOKIES]) res.clearCookie(name, { path: "/" });
  }
}
