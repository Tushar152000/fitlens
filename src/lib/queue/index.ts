import { Queue } from "bullmq";
import IORedis from "ioredis";
import { env } from "@/lib/env";

export const MEAL_QUEUE = "meal-analysis";

export interface MealJob {
  mealLogId: string;
}

let connection: IORedis | undefined;
let mealQueue: Queue<MealJob> | undefined;

export function redisConnection(): IORedis {
  const url = env().REDIS_URL;
  if (!url) throw new Error("REDIS_URL is not set");
  connection ??= new IORedis(url, { maxRetriesPerRequest: null });
  return connection;
}

export function queueEnabled(): boolean {
  return Boolean(env().REDIS_URL);
}

export function getMealQueue(): Queue<MealJob> {
  mealQueue ??= new Queue<MealJob>(MEAL_QUEUE, {
    connection: redisConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: 1000,
    },
  });
  return mealQueue;
}
