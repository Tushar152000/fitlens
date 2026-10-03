import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import type { SessionClient, SessionDto } from "@fitlens/contracts";
import { randomToken, sha256Hex } from "../../common/crypto.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { clip, initialExpiry, isSessionLive, slideExpiry, truncateIp } from "./auth.policy.js";

/** Who is calling, for the device list and audit log. */
export interface ClientMeta {
  ip?: string | null;
  userAgent?: string | null;
}

export const clientMeta = (req: Request): ClientMeta => ({
  ip: req.ip ?? req.socket?.remoteAddress ?? null,
  userAgent: req.headers["user-agent"] ?? null,
});

/** An authenticated request's identity. */
export interface AuthContext {
  userId: string;
  sessionId: string;
}

export interface IssuedSession {
  /** The bearer secret. Returned once, never stored. */
  token: string;
  sessionId: string;
  expiresAt: Date;
  absoluteExpiresAt: Date;
}

/**
 * Opaque, database-backed sessions: one mechanism for both clients (web cookie, app bearer token).
 *
 * Why not JWTs: a session must end the moment the user signs out, revokes a device or deletes the
 * account. A row delete does that; a self-contained token would stay valid until it expired.
 * Only SHA-256(token) is stored, so reading the table doesn't let anyone sign in.
 *
 * `authenticate` is the seam for extracting auth into its own service later: other services would
 * call it over the network (token introspection) instead of in-process.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  private idleDays(client: SessionClient): number {
    return client === "MOBILE" ? this.env.MOBILE_SESSION_DAYS : this.env.SESSION_DAYS;
  }

  async create(
    userId: string,
    client: SessionClient,
    meta: ClientMeta,
    now = new Date(),
  ): Promise<IssuedSession> {
    const token = randomToken();
    const { expiresAt, absoluteExpiresAt } = initialExpiry(
      now,
      this.idleDays(client),
      this.env.SESSION_MAX_DAYS,
    );
    const session = await this.prisma.session.create({
      data: {
        tokenHash: sha256Hex(token),
        userId,
        client,
        userAgent: clip(meta.userAgent, 256),
        ip: truncateIp(meta.ip),
        createdAt: now,
        lastSeenAt: now,
        expiresAt,
        absoluteExpiresAt,
      },
      select: { id: true },
    });
    return { token, sessionId: session.id, expiresAt, absoluteExpiresAt };
  }

  /**
   * The session behind a token, or null when unknown or expired. Slides the idle expiry forward at
   * most once a day, so the hot path is a single indexed read.
   */
  async authenticate(token: string, now = new Date()): Promise<AuthContext | null> {
    if (!token || token.length > 512) return null;
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      select: {
        id: true,
        userId: true,
        client: true,
        lastSeenAt: true,
        expiresAt: true,
        absoluteExpiresAt: true,
      },
    });
    if (!session || !isSessionLive(session, now)) return null;
    const touch = slideExpiry(session, now, this.idleDays(session.client));
    if (touch) {
      // updateMany: a concurrent sign-out may have deleted the row; that's fine, not an error.
      await this.prisma.session.updateMany({ where: { id: session.id }, data: touch });
    }
    return { userId: session.userId, sessionId: session.id };
  }

  /** Ends the session behind a token. Returns its owner, or null if there was none. */
  async revokeToken(token: string): Promise<AuthContext | null> {
    const session = await this.prisma.session.findUnique({
      where: { tokenHash: sha256Hex(token) },
      select: { id: true, userId: true },
    });
    if (!session) return null;
    await this.prisma.session.deleteMany({ where: { id: session.id } });
    return { userId: session.userId, sessionId: session.id };
  }

  /** Ends one of the user's sessions. False when it isn't theirs or doesn't exist (→ 404). */
  async revokeById(userId: string, sessionId: string): Promise<boolean> {
    const { count } = await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
    return count > 0;
  }

  /** Ends every session the user has (all devices). Returns how many. */
  async revokeAll(userId: string): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({ where: { userId } });
    return count;
  }

  /** The user's live sessions, most recently used first. */
  async list(userId: string, currentSessionId: string, now = new Date()): Promise<SessionDto[]> {
    const sessions = await this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: now }, absoluteExpiresAt: { gt: now } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        id: true,
        client: true,
        userAgent: true,
        ip: true,
        createdAt: true,
        lastSeenAt: true,
        expiresAt: true,
      },
    });
    return sessions.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      lastSeenAt: s.lastSeenAt.toISOString(),
      expiresAt: s.expiresAt.toISOString(),
      current: s.id === currentSessionId,
    }));
  }

  /** Housekeeping: drop sessions past either expiry. */
  async deleteExpired(now = new Date()): Promise<number> {
    const { count } = await this.prisma.session.deleteMany({
      where: { OR: [{ expiresAt: { lte: now } }, { absoluteExpiresAt: { lte: now } }] },
    });
    return count;
  }
}
