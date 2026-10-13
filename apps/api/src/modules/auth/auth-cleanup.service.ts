import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { AuthEventsService } from "./auth-events.service.js";
import { AUTH_EVENT_RETENTION_MS } from "./auth.policy.js";
import { SessionService } from "./session.service.js";

const INTERVAL_MS = 60 * 60_000;

/**
 * Hourly housekeeping on worker processes (APP_ROLE=worker|all): expired sessions and app codes,
 * and sign-in history past its retention. Every step is an idempotent delete, so several workers
 * running it at once is harmless.
 */
@Injectable()
export class AuthCleanupService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(AuthCleanupService.name);
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly sessions: SessionService,
    private readonly events: AuthEventsService,
    private readonly prisma: PrismaService,
    @InjectEnv() private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (this.env.APP_ROLE === "api" || this.env.APP_ENV === "test") return;
    this.timer = setInterval(() => void this.run(), INTERVAL_MS);
    this.timer.unref();
    void this.run();
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(now = new Date()) {
    try {
      const sessions = await this.sessions.deleteExpired(now);
      const { count: codes } = await this.prisma.authCode.deleteMany({
        where: { expiresAt: { lte: now } },
      });
      const events = await this.events.deleteOlderThan(
        new Date(now.getTime() - AUTH_EVENT_RETENTION_MS),
      );
      if (sessions || codes || events) {
        this.logger.log(`Removed ${sessions} sessions, ${codes} app codes, ${events} auth events`);
      }
      return { sessions, codes, events };
    } catch (err) {
      this.logger.warn(`Auth cleanup failed: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }
}
