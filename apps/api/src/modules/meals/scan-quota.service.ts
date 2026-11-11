import { Injectable } from "@nestjs/common";
import { startOfLocalDay } from "@fitr8/domain/dates";
import { AppError } from "../../common/errors.js";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { BillingService } from "../billing/billing.service.js";
import { UsersService } from "../users/users.service.js";

/** Typed meals are free; this only stops runaway use. Not shown to users. */
const TEXT_DAILY_CAP = 60;

/** Per-user AI quotas, counted from AiCall rows within the user's local day (design 9c); limits by plan. */
@Injectable()
export class ScanQuotaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
    private readonly billing: BillingService,
  ) {}

  private async userDayStart(userId: string) {
    const tz = await this.users.timezone(userId);
    const since = startOfLocalDay(tz);
    // 26 h later is always inside the next local day, even across a DST change.
    const resetsAt = startOfLocalDay(tz, new Date(since.getTime() + 26 * 60 * 60 * 1000));
    return { since, resetsAt };
  }

  /**
   * Photo scans used today (local day). Only successful photo/label reads of real food count:
   * typed meals, "usuals", not-food results and our own failures never do.
   */
  async scanUsage(userId: string) {
    const [{ since, resetsAt }, { plan, paywall, scans: limit }] = await Promise.all([
      this.userDayStart(userId),
      this.billing.limits(userId),
    ]);
    const used = await this.prisma.aiCall.count({
      where: { userId, countsAsScan: true, createdAt: { gte: since } },
    });
    return {
      used,
      limit,
      left: Math.max(0, limit - used),
      resetsAt: resetsAt.toISOString(),
      plan,
      paywall,
    };
  }

  /** Throws 429 with the usage in `details` (for the 9c sheet) when no photo scans are left. */
  async assertCanScanPhoto(userId: string) {
    const usage = await this.scanUsage(userId);
    if (usage.left <= 0) {
      throw new AppError(
        429,
        usage.plan === "PRO"
          ? `You've used today's ${usage.limit} photo scans. They reset at midnight.`
          : `You've used today's ${usage.limit} free photo scans.`,
        usage,
      );
    }
    return usage;
  }

  async assertWithinTextCap(userId: string) {
    const { since } = await this.userDayStart(userId);
    const count = await this.prisma.aiCall.count({
      where: { userId, type: "MEAL_TEXT", createdAt: { gte: since } },
    });
    if (count >= TEXT_DAILY_CAP) {
      throw new AppError(429, "That's a lot of typed meals for one day. Try again tomorrow.");
    }
  }
}

export type ScanUsage = Awaited<ReturnType<ScanQuotaService["scanUsage"]>>;
