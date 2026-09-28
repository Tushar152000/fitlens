import { Global, Inject, Module, type OnApplicationShutdown } from "@nestjs/common";
import { Redis } from "ioredis";
import { ENV, type Env } from "../../config/config.module.js";

export const REDIS = Symbol("REDIS");
/** `null` when REDIS_URL is unset: callers fall back to in-process behaviour (inline jobs, local locks). */
export const InjectRedis = () => Inject(REDIS);
export type RedisClient = Redis | null;

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ENV],
      // BullMQ requires maxRetriesPerRequest: null on the connections it uses.
      useFactory: (env: Env): RedisClient =>
        env.REDIS_URL ? new Redis(env.REDIS_URL, { maxRetriesPerRequest: null }) : null,
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnApplicationShutdown {
  constructor(@InjectRedis() private readonly redis: RedisClient) {}

  async onApplicationShutdown() {
    await this.redis?.quit().catch(() => undefined);
  }
}
