import { Injectable } from "@nestjs/common";
import type { CheckinInput } from "@fitlens/contracts";
import { localDate, parseDateOnly } from "@fitlens/domain/dates";
import { bodyFatNavy } from "@fitlens/domain/nutrition";
import { PrismaService } from "../../infra/prisma/prisma.service.js";

/** Weigh-ins (body_metrics). One row per user per date; logging again that day replaces it. */
@Injectable()
export class CheckinsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Logs a weigh-in. The weekly adjustment rules (PRD section 8) are added in week 5;
   * for now this stores the metric so trends can be charted.
   */
  async logWeighIn(userId: string, input: CheckinInput) {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    const date = input.date ? parseDateOnly(input.date) : localDate(profile?.timezone);

    const bodyFatPct =
      profile && input.waistCm && input.neckCm
        ? bodyFatNavy({
            sex: profile.sex,
            heightCm: profile.heightCm,
            waistCm: input.waistCm,
            neckCm: input.neckCm,
            hipCm: input.hipCm,
          })
        : null;

    const data = {
      weightKg: input.weightKg,
      waistCm: input.waistCm,
      neckCm: input.neckCm,
      hipCm: input.hipCm,
      bodyFatPct,
    };
    const metric = await this.prisma.bodyMetric.upsert({
      where: { userId_date: { userId, date } },
      create: { userId, date, ...data },
      update: data,
    });
    return { metric };
  }

  async list(userId: string) {
    const metrics = await this.prisma.bodyMetric.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      take: 120,
    });
    return { metrics };
  }
}
