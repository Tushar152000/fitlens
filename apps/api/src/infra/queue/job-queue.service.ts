import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnApplicationShutdown,
} from "@nestjs/common";
import { Queue, Worker, type JobsOptions } from "bullmq";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { InjectRedis, type RedisClient } from "../redis/redis.module.js";

/** A background job type. Feature modules own their handlers and register them on init. */
export interface JobHandler<T> {
  /** Queue name, e.g. "meal-analysis". One handler per queue. */
  readonly queue: string;
  readonly concurrency?: number;
  handle(data: T): Promise<void>;
}

export type EnqueueResult = "queued" | "done";

/**
 * Async work with a graceful local fallback.
 *
 * - With REDIS_URL: jobs go to BullMQ (3 attempts, exponential backoff); processes started with
 *   APP_ROLE=worker|all consume them. Scale workers independently of the HTTP tier.
 * - Without it: `enqueue` runs the handler inline and returns "done" (dev, tests, single-box deploys).
 *
 * Handlers must be idempotent: a job can run more than once after a crash or retry.
 */
@Injectable()
export class JobQueue implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(JobQueue.name);
  private readonly handlers = new Map<string, JobHandler<unknown>>();
  private readonly queues = new Map<string, Queue>();
  private readonly workers: Worker[] = [];

  constructor(
    @InjectRedis() private readonly redis: RedisClient,
    @InjectEnv() private readonly env: Env,
  ) {}

  get isAsync(): boolean {
    return this.redis !== null;
  }

  register<T>(handler: JobHandler<T>) {
    if (this.handlers.has(handler.queue))
      throw new Error(`Duplicate job handler for "${handler.queue}"`);
    this.handlers.set(handler.queue, handler as JobHandler<unknown>);
  }

  async enqueue<T>(
    queue: string,
    data: T,
    opts: Pick<JobsOptions, "jobId" | "delay"> = {},
  ): Promise<EnqueueResult> {
    const handler = this.handlers.get(queue);
    if (!handler) throw new Error(`No job handler registered for "${queue}"`);
    if (!this.redis) {
      await handler.handle(data);
      return "done";
    }
    await this.queueFor(queue).add(queue, data, {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
      removeOnFail: 5000,
      ...opts,
    });
    return "queued";
  }

  onApplicationBootstrap() {
    if (!this.redis || this.env.APP_ROLE === "api") return;
    for (const handler of this.handlers.values()) {
      const worker = new Worker(handler.queue, (job) => handler.handle(job.data), {
        connection: this.redis,
        concurrency: handler.concurrency ?? 4,
      });
      worker.on("failed", (job, err) =>
        this.logger.warn(`[${handler.queue}] job ${job?.id} failed: ${err.message}`),
      );
      this.workers.push(worker);
      this.logger.log(`Consuming "${handler.queue}"`);
    }
  }

  async onApplicationShutdown() {
    // Let in-flight jobs finish before the process exits (SIGTERM on deploys).
    await Promise.all(this.workers.map((w) => w.close()));
    await Promise.all([...this.queues.values()].map((q) => q.close()));
  }

  private queueFor(name: string): Queue {
    let queue = this.queues.get(name);
    if (!queue) {
      queue = new Queue(name, { connection: this.redis! });
      this.queues.set(name, queue);
    }
    return queue;
  }
}
