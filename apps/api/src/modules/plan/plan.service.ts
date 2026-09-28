import { Injectable } from "@nestjs/common";
import type { GoalOptionInput, OnboardingInput } from "@fitlens/contracts";
import { localDate, parseDateOnly } from "@fitlens/domain/dates";
import { bodyFatNavy } from "@fitlens/domain/nutrition";
import { AppError } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { UsersService } from "../users/users.service.js";
import { planSummary, TargetsService } from "./targets.service.js";

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/** Onboarding and goal changes: profile + goal in, a fresh DailyTarget out. */
@Injectable()
export class PlanService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly targets: TargetsService,
    private readonly users: UsersService,
  ) {}

  /** Save profile, first body metric and goal, then compute targets. Re-running replaces the active goal. */
  async onboard(userId: string, input: OnboardingInput) {
    const today = localDate(input.timezone);

    const bodyFatPct =
      input.waistCm && input.neckCm
        ? bodyFatNavy({
            sex: input.sex,
            heightCm: input.heightCm,
            waistCm: input.waistCm,
            neckCm: input.neckCm,
            hipCm: input.hipCm,
          })
        : null;

    const profileData = {
      sex: input.sex,
      birthDate: parseDateOnly(input.birthDate),
      heightCm: input.heightCm,
      activityLevel: input.activityLevel,
      dietType: input.dietType,
      experience: input.experience,
      equipment: input.equipment,
      trainingDaysPerWeek: input.trainingDaysPerWeek,
      sessionMinutes: input.sessionMinutes,
      injuries: input.injuries,
      medicalFlag: input.medicalFlag,
      timezone: input.timezone,
      onboardedAt: new Date(),
    };
    const metric = {
      weightKg: input.weightKg,
      waistCm: input.waistCm,
      neckCm: input.neckCm,
      hipCm: input.hipCm,
      bodyFatPct,
    };

    // One transaction so a half-onboarded user can't exist. The starting weigh-in is the one write
    // outside this module's tables (body_metrics belongs to progress): it must commit with the goal.
    await this.prisma.$transaction([
      this.prisma.profile.upsert({
        where: { userId },
        create: { userId, ...profileData },
        update: profileData,
      }),
      this.prisma.bodyMetric.upsert({
        where: { userId_date: { userId, date: today } },
        create: { userId, date: today, ...metric },
        update: metric,
      }),
      this.prisma.goal.updateMany({
        where: { userId, status: "ACTIVE" },
        data: { status: "ABANDONED" },
      }),
      this.prisma.goal.create({
        data: {
          userId,
          type: input.goal.type,
          startWeightKg: input.weightKg,
          startBodyFatPct: bodyFatPct,
          targetWeightKg: input.goal.targetWeightKg,
          targetBodyFatPct: input.goal.targetBodyFatPct,
          startDate: today,
          targetDate: parseDateOnly(input.goal.targetDate),
        },
      }),
    ]);

    const { target, plan } = await this.targets.recomputeTargets(
      userId,
      "Initial targets from onboarding",
      today,
    );
    return planSummary({
      plan,
      target,
      weightKg: input.weightKg,
      heightCm: input.heightCm,
      bodyFatPct,
    });
  }

  /** GET /targets: today's target (keyed by the user's local date, which can be ahead of UTC). */
  async todayTarget(userId: string) {
    const target = await this.targets.currentTarget(userId, await this.users.today(userId));
    if (!target) throw new AppError(404, "Finish onboarding first");
    return { target };
  }

  /**
   * Screen 5 data, rebuilt from the database: the plan summary plus the active goal and latest body
   * metric (the app also uses these to prefill onboarding when the goal is edited).
   */
  async getPlan(userId: string) {
    let computed;
    try {
      computed = await this.targets.computePlan(userId);
    } catch {
      throw new AppError(404, "Finish onboarding first");
    }
    const { plan, metric, goal, profile, bodyFatPct } = computed;
    const target = await this.targets.currentTarget(userId, localDate(profile.timezone));
    if (!target) throw new AppError(404, "Finish onboarding first");

    return {
      summary: planSummary({
        plan,
        target,
        weightKg: metric.weightKg,
        heightCm: profile.heightCm,
        bodyFatPct,
      }),
      goal: {
        type: goal.type,
        targetDate: ymd(goal.targetDate),
        targetWeightKg: goal.targetWeightKg,
        targetBodyFatPct: goal.targetBodyFatPct,
      },
      metric: {
        date: ymd(metric.date),
        bodyFatPct: metric.bodyFatPct,
        weightKg: metric.weightKg,
        waistCm: metric.waistCm,
        neckCm: metric.neckCm,
        hipCm: metric.hipCm,
      },
      training: {
        daysPerWeek: profile.trainingDaysPerWeek,
        sessionMinutes: profile.sessionMinutes,
      },
    };
  }

  /**
   * Design 5b: the goal is too fast, so the user picks one of the two safe options.
   * KEEP_GOAL moves the date out; KEEP_DATE keeps the date and moves the target closer.
   */
  async chooseGoalOption(userId: string, { choice }: GoalOptionInput) {
    const { plan, goal, profile } = await this.targets.computePlan(userId);
    if (plan.feasible) return { ok: true, changed: false } as const;

    const fmt = (d: Date) =>
      new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "UTC" }).format(
        d,
      );
    let reason: string;
    if (choice === "KEEP_GOAL") {
      if (!plan.suggestedTargetDate) throw new AppError(409, "No safer date to move to");
      await this.prisma.goal.update({
        where: { id: goal.id },
        data: { targetDate: plan.suggestedTargetDate },
      });
      reason = `Goal date moved to ${fmt(plan.suggestedTargetDate)} to keep a safe pace`;
    } else {
      if (plan.closerTargetWeightKg == null) throw new AppError(409, "No closer target available");
      const target = Math.round(plan.closerTargetWeightKg * 2) / 2; // nearest 0.5 kg
      await this.prisma.goal.update({
        where: { id: goal.id },
        data: { targetWeightKg: target, targetBodyFatPct: null },
      });
      reason = `Target set to ${target} kg by ${fmt(goal.targetDate)} to keep a safe pace`;
    }

    const { target } = await this.targets.recomputeTargets(
      userId,
      reason,
      localDate(profile.timezone),
    );
    return { ok: true, changed: true, target } as const;
  }
}
