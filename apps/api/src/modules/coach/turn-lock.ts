import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { InjectRedis, type RedisClient } from "../../infra/redis/redis.module.js";

const TTL_MS = 3 * 60 * 1000;

/**
 * One reply at a time per conversation. Two concurrent turns would interleave writes and break the
 * append-only transcript. Redis makes it hold across API instances; without Redis it is per process.
 * The TTL frees a lock whose holder crashed.
 */
@Injectable()
export class TurnLock {
  private readonly local = new Map<string, number>();

  constructor(@InjectRedis() private readonly redis: RedisClient) {}

  /** Returns a release function, or null if a turn is already running. */
  async acquire(conversationId: string): Promise<(() => Promise<void>) | null> {
    const key = `coach:turn:${conversationId}`;
    if (this.redis) {
      const owner = randomUUID();
      const ok = await this.redis.set(key, owner, "PX", TTL_MS, "NX");
      if (!ok) return null;
      return async () => {
        // Only delete our own lock (it may have expired and been taken by another turn).
        if ((await this.redis!.get(key)) === owner) await this.redis!.del(key);
      };
    }
    const heldUntil = this.local.get(key);
    if (heldUntil && heldUntil > Date.now()) return null;
    this.local.set(key, Date.now() + TTL_MS);
    return async () => {
      this.local.delete(key);
    };
  }
}
