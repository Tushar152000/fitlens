import { Injectable } from "@nestjs/common";
import { waterTarget } from "@fitlens/domain/nutrition";
import { AppError, notFound } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { WorkoutsService } from "../workouts/workouts.service.js";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Water tracking: one row per tap. The daily target is computed from domain rules, never stored. */
@Injectable()
export class WaterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly workouts: WorkoutsService,
  ) {}

  /** The day's target (with the numbers behind it), what's been drunk, and each log for undo. */
  async getDay(userId: string, date: Date) {
    const [profile, metric, goal, logs] = await Promise.all([
      this.prisma.profile.findUnique({
        where: { userId },
        select: { activityLevel: true, medicalFlag: true, remindWater: true },
      }),
      this.prisma.bodyMetric.findFirst({
        where: { userId },
        orderBy: { date: "desc" },
        select: { weightKg: true },
      }),
      this.prisma.goal.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: { type: true },
      }),
      this.prisma.waterLog.findMany({
        where: { userId, date },
        orderBy: { createdAt: "asc" },
        select: { id: true, ml: true, createdAt: true },
      }),
    ]);
    if (!profile || !metric) throw new AppError(404, "Finish onboarding first");

    const trainingDay = await this.workouts.isTrainingDay(userId, date);
    const target = waterTarget({
      weightKg: metric.weightKg,
      activityLevel: profile.activityLevel,
      trainingDay,
      goalType: goal?.type ?? null,
      medicalFlag: profile.medicalFlag,
    });

    return {
      date: ymd(date),
      targetMl: target.ml,
      reason: target.reason,
      tip: target.tip,
      caution: target.caution,
      trainingDay,
      consumedMl: logs.reduce((t, l) => t + l.ml, 0),
      logs,
      remind: profile.remindWater,
    };
  }

  add(userId: string, date: Date, ml: number) {
    return this.prisma.waterLog.create({ data: { userId, date, ml } });
  }

  /** Undo one tap. Only the owner's rows. */
  async remove(userId: string, id: string) {
    const { count } = await this.prisma.waterLog.deleteMany({ where: { id, userId } });
    if (!count) throw notFound("Water entry");
  }
}

export type WaterDay = Awaited<ReturnType<WaterService["getDay"]>>;
