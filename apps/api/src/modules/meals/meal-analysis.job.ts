import { Inject, Injectable, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@fitr8/db";
import { sumMacros } from "@fitr8/domain/nutrition";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { JobQueue, type JobHandler } from "../../infra/queue/job-queue.service.js";
import { StorageService } from "../../infra/storage/storage.service.js";
import { FOOD_EXTRACTOR, type FoodExtractor, type MealContext } from "../ai/index.js";
import { MealItemsService } from "./meal-items.service.js";

export const MEAL_ANALYSIS_QUEUE = "meal-analysis";

export interface MealAnalysisData {
  mealLogId: string;
}

/**
 * Runs the AI on a PENDING meal log and stores detected items. Idempotent: a confirmed meal is left
 * alone and a re-run replaces the items, so a retried or duplicated job is safe.
 */
@Injectable()
export class MealAnalysisJob implements JobHandler<MealAnalysisData>, OnModuleInit {
  readonly queue = MEAL_ANALYSIS_QUEUE;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jobs: JobQueue,
    private readonly storage: StorageService,
    private readonly items: MealItemsService,
    @Inject(FOOD_EXTRACTOR) private readonly extractor: FoodExtractor,
  ) {}

  onModuleInit() {
    this.jobs.register(this);
  }

  async handle({ mealLogId }: MealAnalysisData) {
    const log = await this.prisma.mealLog.findUnique({
      where: { id: mealLogId },
      include: { user: { include: { profile: true } } },
    });
    if (!log || log.status === "CONFIRMED") return;

    await this.prisma.mealLog.update({
      where: { id: log.id },
      data: { status: "ANALYZING", error: null },
    });

    const frequent = await this.prisma.mealItem.groupBy({
      by: ["name"],
      where: { mealLog: { userId: log.userId, status: "CONFIRMED" } },
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
      take: 20,
    });

    const context: MealContext = {
      mealType: log.mealType,
      dietType: log.user.profile?.dietType ?? "VEG",
      frequentFoods: frequent.map((f) => f.name),
      userNote: log.note ?? undefined,
    };

    const type = log.source === "PHOTO" ? "MEAL_PHOTO" : "MEAL_TEXT";
    const started = Date.now();
    try {
      // The photo's bytes go to the model inline, so the provider never needs access to our bucket.
      const result =
        log.source === "PHOTO"
          ? await this.extractor.analyzeMealPhoto({
              image: await this.storage.getImage(log.photoKey!),
              context,
            })
          : await this.extractor.parseMealText({ text: log.inputText ?? log.note ?? "", context });

      await this.prisma.aiCall.create({
        data: {
          userId: log.userId,
          type,
          provider: result.usage.provider,
          model: result.usage.model,
          tokensIn: result.usage.tokensIn,
          tokensOut: result.usage.tokensOut,
          latencyMs: result.usage.latencyMs,
          success: true,
          // A not-food photo doesn't use up a scan (design 9b).
          countsAsScan: log.source === "PHOTO" && result.data.isFood,
        },
      });

      if (!result.data.isFood) {
        await this.prisma.mealLog.update({
          where: { id: log.id },
          data: {
            status: "FAILED",
            error: "That doesn't look like food. Try another photo.",
            aiRaw: result.data as unknown as Prisma.InputJsonValue,
          },
        });
        return;
      }

      const items = await Promise.all(
        result.data.items.map(async (d) => ({
          // When the user wrote details ("small 120 ml cup"), keep the model's amounts over standard unit sizes.
          ...(await this.items.buildItem(
            { ...d, isLiquid: d.isDrink },
            { trustGrams: log.note ? "containers" : false },
          )),
          aiConfidence: d.confidence,
          aiGrams: d.grams,
        })),
      );
      const totals = sumMacros(items);

      await this.prisma.$transaction([
        this.prisma.mealItem.deleteMany({ where: { mealLogId: log.id } }),
        this.prisma.mealItem.createMany({ data: items.map((i) => ({ ...i, mealLogId: log.id })) }),
        this.prisma.mealLog.update({
          where: { id: log.id },
          data: {
            status: "READY",
            aiRaw: result.data as unknown as Prisma.InputJsonValue,
            aiNotes: result.data.hiddenFatLikely
              ? [result.data.notes, "Oil or ghee may have been added — adjust if needed."]
                  .filter(Boolean)
                  .join(" ")
              : result.data.notes,
            totalKcal: totals.kcal,
            totalProtein: totals.proteinG,
            totalCarbs: totals.carbsG,
            totalFat: totals.fatG,
          },
        }),
      ]);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.aiCall.create({
        data: {
          userId: log.userId,
          type,
          provider: this.extractor.name,
          model: "unknown",
          latencyMs: Date.now() - started,
          success: false,
          error: message.slice(0, 500),
        },
      });
      await this.prisma.mealLog.update({
        where: { id: log.id },
        data: { status: "FAILED", error: "Analysis failed. You can retry or log by text." },
      });
      // Rethrow so a queued job is retried (inline callers ignore it: the failure is on the log).
      throw err;
    }
  }
}
