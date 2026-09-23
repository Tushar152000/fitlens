/**
 * Background worker for AI jobs. Run with: npm run worker
 * Needs REDIS_URL. Without Redis the API analyses meals inline instead.
 */
import "dotenv/config";
import { Worker } from "bullmq";
import { MEAL_QUEUE, redisConnection, type MealJob } from "@/lib/queue";
import { analyzeMealLog } from "@/lib/services/meals";

const worker = new Worker<MealJob>(
  MEAL_QUEUE,
  async (job) => {
    await analyzeMealLog(job.data.mealLogId);
  },
  { connection: redisConnection(), concurrency: 4 },
);

worker.on("completed", (job) => console.log(`[meal] done ${job.id}`));
worker.on("failed", (job, err) => console.error(`[meal] failed ${job?.id}: ${err.message}`));

const shutdown = async () => {
  await worker.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

console.log(`Worker listening on "${MEAL_QUEUE}"`);
