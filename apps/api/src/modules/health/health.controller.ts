import { Controller, Get, Res } from "@nestjs/common";
import type { Response } from "express";
import { Public } from "../../common/auth/decorators.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { InjectRedis, type RedisClient } from "../../infra/redis/redis.module.js";

@Public()
@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: RedisClient,
  ) {}

  /** Liveness: the process is up. Orchestrators restart the container when this fails. */
  @Get("live")
  live() {
    return { status: "ok" };
  }

  /** Readiness: dependencies reachable. Load balancers stop routing here when this is 503. */
  @Get()
  async ready(@Res({ passthrough: true }) res: Response) {
    const [db, redis] = await Promise.all([
      this.prisma.$queryRaw`SELECT 1`.then(() => "ok" as const).catch(() => "down" as const),
      this.redis
        ? this.redis
            .ping()
            .then(() => "ok" as const)
            .catch(() => "down" as const)
        : Promise.resolve("disabled" as const),
    ]);
    const ok = db === "ok" && redis !== "down";
    res.status(ok ? 200 : 503);
    return { status: ok ? "ok" : "degraded", db, redis };
  }
}
