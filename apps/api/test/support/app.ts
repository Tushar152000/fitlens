import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { applyTestEnv } from "./env.js";
import { FakeApple } from "./fake-apple.js";
import { FakeGoogle } from "./fake-google.js";

applyTestEnv();
const { AppModule } = await import("../../src/app.module.js");
const { PrismaService } = await import("../../src/infra/prisma/prisma.service.js");
const { GOOGLE_OIDC } = await import("../../src/modules/auth/google/oidc.js");
const { APPLE_ID } = await import("../../src/modules/auth/apple/apple-id.js");

export interface TestApp {
  app: INestApplication;
  prisma: InstanceType<typeof PrismaService>;
  http: () => ReturnType<typeof request>;
  /** A fresh cookie jar (a browser). */
  browser: () => ReturnType<typeof request.agent>;
  /** Google, as far as the API can tell. */
  google: FakeGoogle;
  /** Sign in with Apple, as far as the API can tell. */
  apple: FakeApple;
  /** A fresh signed-in user. Requests made through the returned agent carry the session cookie. */
  signIn: (
    name?: string,
  ) => Promise<{ userId: string; token: string; agent: ReturnType<typeof request.agent> }>;
  close: () => Promise<void>;
}

export interface TestAppOptions {
  /** Environment overrides for this app only (e.g. a low AUTH_RATE_LIMIT). */
  env?: Record<string, string>;
}

/** Boots the real AppModule (same middleware as main.ts) against the test database, with a fake Google. */
export async function createTestApp(options: TestAppOptions = {}): Promise<TestApp> {
  const google = new FakeGoogle();
  const apple = new FakeApple();
  const saved = { ...process.env };
  Object.assign(process.env, options.env);
  let moduleRef;
  try {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(GOOGLE_OIDC)
      .useValue(google)
      .overrideProvider(APPLE_ID)
      .useValue(apple)
      .compile();
  } finally {
    process.env = saved;
  }
  const app = moduleRef.createNestApplication({ logger: false });
  app.setGlobalPrefix("api");
  app.use(cookieParser());
  await app.init();
  const server = app.getHttpServer();
  const prisma = app.get(PrismaService);

  return {
    app,
    prisma,
    http: () => request(server),
    browser: () => request.agent(server),
    google,
    apple,
    async signIn(name = "Test User") {
      const agent = request.agent(server);
      const res = await agent
        .post("/api/auth/dev")
        .send({ email: `${randomUUID()}@test.fitlens`, name })
        .expect(200);
      return { userId: res.body.userId as string, token: res.body.token as string, agent };
    },
    close: () => app.close(),
  };
}

/** A completed onboarding payload (vegetarian, fat loss, 3 training days). Override fields per test. */
export function onboardingPayload(overrides: Record<string, unknown> = {}) {
  const inMonths = (n: number) => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + n);
    return d.toISOString().slice(0, 10);
  };
  return {
    sex: "MALE",
    birthDate: "1995-06-15",
    heightCm: 175,
    weightKg: 82,
    activityLevel: "LIGHT",
    dietType: "VEG",
    experience: "BEGINNER",
    equipment: "FULL_GYM",
    trainingDaysPerWeek: 3,
    sessionMinutes: 45,
    injuries: [],
    medicalFlag: false,
    timezone: "Asia/Kolkata",
    goal: { type: "FAT_LOSS", targetWeightKg: 76, targetDate: inMonths(6) },
    ...overrides,
  };
}

/** Completes onboarding through the API (the real flow), returning the plan summary. */
export async function onboard(
  agent: ReturnType<typeof request.agent>,
  overrides: Record<string, unknown> = {},
) {
  const res = await agent.post("/api/onboarding").send(onboardingPayload(overrides)).expect(201);
  return res.body as { target: { kcal: number }; plan: { feasible: boolean } };
}

/** A random, valid EAN-13 (the test database persists between runs, and barcodes are unique). */
export function randomEan13(): string {
  const body = Array.from({ length: 12 }, (_, i) =>
    i === 0 ? 2 : Math.floor(Math.random() * 10),
  ).join("");
  const sum = body
    .split("")
    .reverse()
    .reduce((s, d, i) => s + Number(d) * (i % 2 === 0 ? 3 : 1), 0);
  return `${body}${(10 - (sum % 10)) % 10}`;
}
