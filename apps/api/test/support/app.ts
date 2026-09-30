import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import cookieParser from "cookie-parser";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { applyTestEnv } from "./env.js";

applyTestEnv();
const { AppModule } = await import("../../src/app.module.js");
const { PrismaService } = await import("../../src/infra/prisma/prisma.service.js");

export interface TestApp {
  app: INestApplication;
  prisma: InstanceType<typeof PrismaService>;
  http: () => ReturnType<typeof request>;
  /** A fresh signed-in user. Requests made through the returned agent carry the session cookie. */
  signIn: (
    name?: string,
  ) => Promise<{ userId: string; token: string; agent: ReturnType<typeof request.agent> }>;
  close: () => Promise<void>;
}

/** Boots the real AppModule (same middleware as main.ts) against the test database. */
export async function createTestApp(): Promise<TestApp> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
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
    async signIn(name = "Test User") {
      const agent = request.agent(server);
      const res = await agent
        .post("/api/auth/dev")
        .send({ email: `${randomUUID()}@test.fitlens`, name })
        .expect(201);
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
