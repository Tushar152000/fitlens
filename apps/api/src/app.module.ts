import { Module } from "@nestjs/common";
import { APP_FILTER, APP_GUARD } from "@nestjs/core";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { LoggerModule } from "nestjs-pino";
import { randomUUID } from "node:crypto";
import { AuthGuard } from "./common/auth/auth.guard.js";
import { AllExceptionsFilter } from "./common/http/exception.filter.js";
import { ConfigModule, ENV, type Env } from "./config/config.module.js";
import { InfraModule } from "./infra/infra.module.js";
import { AiModule } from "./modules/ai/ai.module.js";
import { CoachModule } from "./modules/coach/coach.module.js";
import { AuthModule } from "./modules/auth/auth.module.js";
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
    // Default budget per client IP; AI routes add stricter per-user caps in their services.
    ThrottlerModule.forRoot([{ name: "default", ttl: 60_000, limit: 300 }]),
    InfraModule,
    AiModule,
    AuthModule,
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
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule {}
