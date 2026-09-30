import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { loadDotenv } from "./config/dotenv.js";

loadDotenv();
process.env.APP_ROLE ??= "worker";

/**
 * Queue-consumer entrypoint: the same modules without an HTTP server. JobQueue starts a BullMQ worker
 * for every registered handler. Scale this deployment separately from the API.
 */
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();
  await app.init();
  app.get(Logger).log("Worker started");
}

await bootstrap();
