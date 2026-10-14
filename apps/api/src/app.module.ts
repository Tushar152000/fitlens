import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "node:crypto";
import { AllExceptionsFilter } from "./common/http/exception.filter.js";
import { isStrictRateLimited } from "./common/http/rate-limit.js";
import { ConfigModule, ENV, type Env } from "./config/config.module.js";
import { InfraModule } from "./infra/infra.module.js";
import { AiModule } from "./modules/ai/ai.module.js";
import { CoachModule } from "./modules/coach/coach.module.js";
import { AuthGuard } from "./modules/auth/auth.guard.js";
import { AuthModule } from "./modules/auth/auth.module.js";
import { BillingModule } from "./modules/billing/billing.module.js";
import { OriginGuard } from "./modules/auth/origin.guard.js";
import { FoodsModule } from "./modules/foods/foods.module.js";
import { HealthModule } from "./modules/health/health.module.js";
import { MealsModule } from "./modules/meals/meals.module.js";
import { PlanModule } from "./modules/plan/plan.module.js";
import { ProgressModule } from "./modules/progress/progress.module.js";
import { UsersModule } from "./modules/users/users.module.js";
import { WaterModule } from "./modules/water/water.module.js";
import { WorkoutsModule } from "./modules/workouts/workouts.module.js";

/**
 * Composition root. Feature modules are bounded contexts (see docs/ARCHITECTURE.md): each owns its
 * tables and exposes a service; they talk only through those exported services.
 */
@Module({
  imports: [
    ConfigModule,
    LoggerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({
        pinoHttp: {
          level: env.LOG_LEVEL,
          genReqId: (req, res) => {
            const id = (req.headers["x-request-id"] as string | undefined) ?? randomUUID();
            res.setHeader("x-request-id", id);
            return id;
          },
          // Keep lines short: method, path, status, timing and the request id are what we search on.
          serializers: {
            req: (req: { id: string; method: string; url: string }) => ({
              id: req.id,
              method: req.method,
              url: req.url,
            }),
            res: (res: { statusCode: number }) => ({ status: res.statusCode }),
          },
          autoLogging: { ignore: (req) => req.url?.startsWith("/api/health") ?? false },
          transport:
            env.NODE_ENV === "development"
              ? { target: "pino-pretty", options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    // Per client IP and route. Sign-in routes (@StrictRateLimit) get AUTH_RATE_LIMIT; AI routes add
    // per-user caps in their services. In-memory per process: put it on Redis before scaling out.
    ThrottlerModule.forRootAsync({
      inject: [ENV],
      useFactory: (env: Env) => [
        {
          name: "default",
          ttl: 60_000,
          limit: (ctx) => (isStrictRateLimited(ctx) ? env.AUTH_RATE_LIMIT : 300),
        },
      ],
    }),
    InfraModule,
    AiModule,
    AuthModule,
    BillingModule,
    UsersModule,
    HealthModule,
    // Feature contexts (docs/ARCHITECTURE.md §3.2).
    PlanModule,
    MealsModule,
    FoodsModule,
    WorkoutsModule,
    WaterModule,
    ProgressModule,
    CoachModule,
  ],
  // Guards run in this order: rate limit → CSRF origin check → session.
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useExisting: OriginGuard },
    { provide: APP_GUARD, useExisting: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
