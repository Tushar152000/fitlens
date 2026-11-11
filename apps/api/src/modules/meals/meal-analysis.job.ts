import { Inject, Injectable, Logger, type OnModuleInit } from "@nestjs/common";
import type { Prisma } from "@fitr8/db";
import { sumMacros } from "@fitr8/domain/nutrition";
import { PrismaService } from "../../infra/prisma/prisma.service.js";
import { JobQueue, type JobHandler } from "../../infra/queue/job-queue.service.js";
import { StorageService } from "../../infra/storage/storage.service.js";
import { FOOD_EXTRACTOR, type FoodExtractor, type MealContext } from "../ai/index.js";
import { MealItemsService } from "./meal-items.service.js";

export const MEAL_ANALYSIS_QUEUE = "meal-analysis";
const FREQUENT_FOODS_DAYS = 90;

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
  private readonly logger = new Logger(MealAnalysisJob.name);

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
    const t0 = Date.now();
    const timings: Record<string, number> = {};
    const lap = (stage: string, since: number) => (timings[stage] = Date.now() - since);

    const log = await this.prisma.mealLog.findUnique({
      where: { id: mealLogId },
      include: { user: { select: { profile: { select: { dietType: true } } } } },
    });
    if (!log || log.status === "CONFIRMED") return;
    lap("load", t0);

    const type = log.source === "PHOTO" ? "MEAL_PHOTO" : "MEAL_TEXT";
    const started = Date.now();
    try {
      // Everything the model call needs, fetched at once. The photo's bytes go to the model inline, so
      // the provider never needs access to our bucket.
      const [, frequent, image] = await Promise.all([
        this.prisma.mealLog.update({
          where: { id: log.id },
          data: { status: "ANALYZING", error: null },
        }),
        this.frequentFoods(log.userId),
        log.source === "PHOTO" ? this.storage.getImage(log.photoKey!) : null,
      ]);
      lap("prepare", started);

      const context: MealContext = {
        mealType: log.mealType,
        dietType: log.user.profile?.dietType ?? "VEG",
        frequentFoods: frequent,
        userNote: log.note ?? undefined,
      };

      const modelStarted = Date.now();
      const result = image
        ? await this.extractor.analyzeMealPhoto({ image, context })
        : await this.extractor.parseMealText({ text: log.inputText ?? log.note ?? "", context });
      lap("model", modelStarted);

      const recordCall = this.prisma.aiCall.create({
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
        await recordCall;
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

      const priceStarted = Date.now();
      const [items] = await Promise.all([
        Promise.all(
          result.data.items.map(async (d) => ({
            // When the user wrote details ("small 120 ml cup"), keep the model's amounts over standard unit sizes.
            ...(await this.items.buildItem(
              { ...d, isLiquid: d.isDrink },
              { trustGrams: log.note ? "containers" : false },
            )),
            aiConfidence: d.confidence,
            aiGrams: d.grams,
          })),
        ),
        recordCall,
      ]);
      lap("price", priceStarted);
      const totals = sumMacros(items);

      const saveStarted = Date.now();
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
      lap("save", saveStarted);
      this.logger.log({
        msg: "meal analysed",
        mealLogId: log.id,
        source: log.source,
        model: result.usage.model,
        items: items.length,
        matched: items.filter((i) => !i.approximate).length,
        totalMs: Date.now() - t0,
        ...timings,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn({
        msg: "meal analysis failed",
        mealLogId: log.id,
        totalMs: Date.now() - t0,
        ...timings,
      });
      await Promise.all([
        this.prisma.aiCall.create({
          data: {
            userId: log.userId,
            type,
            provider: this.extractor.name,
            model: "unknown",
            latencyMs: Date.now() - started,
            success: false,
            error: message.slice(0, 500),
          },
        }),
        this.prisma.mealLog.update({
          where: { id: log.id },
          data: { status: "FAILED", error: "Analysis failed. You can retry or log by text." },
        }),
      ]);
      // Rethrow so a queued job is retried (inline callers ignore it: the failure is on the log).
      throw err;
    }
  }

  /**
   * The user's 20 most-logged foods over the last 90 days, as a hint for the model. Bounded by date so
   * it stays one indexed scan however long the user's history grows.
   */
  private async frequentFoods(userId: string): Promise<string[]> {
    const since = new Date(Date.now() - FREQUENT_FOODS_DAYS * 24 * 3600 * 1000);
    const rows = await this.prisma.mealItem.groupBy({
      by: ["name"],
      where: { mealLog: { userId, status: "CONFIRMED", date: { gte: since } } },
      _count: { name: true },
      orderBy: { _count: { name: "desc" } },
      take: 20,
    });
    return rows.map((r) => r.name);
  }
}
