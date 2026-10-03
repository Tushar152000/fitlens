import { Injectable, Logger } from "@nestjs/common";
import type { SessionClient } from "@fitlens/contracts";
import type { AuthEventType } from "@fitlens/db";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { clip, truncateIp } from "./auth.policy.js";
import type { ClientMeta } from "./session.service.js";

export interface AuthEventInput {
  type: AuthEventType;
  userId?: string | null;
  client?: SessionClient | null;
  /** Machine-readable cause, e.g. "state_mismatch". */
  reason?: string | null;
  meta: ClientMeta;
}

/**
 * The security audit trail (sign-ins, failures, sign-outs, revocations). Best effort by design: a
 * failed audit write is logged, never turned into a failed sign-in.
 */
@Injectable()
export class AuthEventsService {
  private readonly logger = new Logger(AuthEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async record({ type, userId, client, reason, meta }: AuthEventInput): Promise<void> {
    try {
      await this.prisma.authEvent.create({
        data: {
          type,
          userId: userId ?? null,
          client: client ?? null,
          reason: clip(reason, 64),
          ip: truncateIp(meta.ip),
          userAgent: clip(meta.userAgent, 256),
        },
      });
    } catch (err) {
      this.logger.warn(
        `auth event ${type} not recorded: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Housekeeping: drop events older than `before`. */
  async deleteOlderThan(before: Date): Promise<number> {
    const { count } = await this.prisma.authEvent.deleteMany({
      where: { createdAt: { lt: before } },
    });
    return count;
  }
}
