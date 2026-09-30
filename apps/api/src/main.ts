import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import type { NestExpressApplication } from "@nestjs/platform-express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { Logger } from "nestjs-pino";
import { AppModule } from "./app.module.js";
import { ENV, type Env } from "./config/config.module.js";
import { loadDotenv } from "./config/dotenv.js";

loadDotenv();

/** HTTP entrypoint (APP_ROLE=api|all). The same image runs `dist/worker.js` for APP_ROLE=worker. */
async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true });
  const env = app.get<Env>(ENV);

  app.useLogger(app.get(Logger));
  app.setGlobalPrefix("api");
  app.set("trust proxy", 1); // behind the web proxy / load balancer: real client IPs for throttling
  app.use(helmet());
  app.use(cookieParser());
  app.useBodyParser("json", { limit: "1mb" });
  // Browsers normally reach the API through the web app's same-origin proxy; CORS is only for extra origins.
  if (env.CORS_ORIGINS.length) app.enableCors({ origin: env.CORS_ORIGINS, credentials: true });
  app.enableShutdownHooks();

  await app.listen(env.PORT);
  app.get(Logger).log(`API listening on :${env.PORT} (role=${env.APP_ROLE})`);
}

await bootstrap();
