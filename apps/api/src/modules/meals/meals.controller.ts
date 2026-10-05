import { Controller, Delete, Get, HttpCode, Param, Post, Put, Query, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  ConfirmMealSchema,
  CreateMealSchema,
  LogItemsSchema,
  ParseItemsSchema,
  QuickAddSchema,
  RecheckSchema,
  RelogSchema,
  UploadUrlSchema,
  type ConfirmMealInput,
  type CreatedDto,
  type CreateMealDto,
  type CreateMealInput,
  type LogItemsInput,
  type MealDetailDto,
  type MealListDto,
  type MealLogDto,
  type ParsedItemsDto,
  type ParseItemsInput,
  type QuickAddInput,
  type RecheckDto,
  type RecheckInput,
  type RelogInput,
  type UploadUrlDto,
  type UploadUrlInput,
  type UsageDto,
  type UsualsDto,
} from "@fitr8/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { wire } from "../../common/http/wire.js";
import { ZodBody } from "../../common/http/zod.js";
import { MealsService } from "./meals.service.js";
import { ScanQuotaService } from "./scan-quota.service.js";
import { UsualsService } from "./usuals.service.js";

/** Thin HTTP adapter: auth + validation here, rules in MealsService. Static paths come before `:id`. */
@Controller()
export class MealsController {
  constructor(
    private readonly meals: MealsService,
    private readonly usuals: UsualsService,
    private readonly quota: ScanQuotaService,
  ) {}

  /** Photo scans used today, the daily limit and when it resets (local midnight). */
  @Get("usage")
  usage(@UserId() userId: string): Promise<UsageDto> {
    return this.quota.scanUsage(userId);
  }

  /** Step 1 of photo logging: get a signed URL, then PUT the (compressed) image to it. */
  @Post("meals/upload-url")
  @HttpCode(200)
  uploadUrl(
    @UserId() userId: string,
    @ZodBody(UploadUrlSchema) input: UploadUrlInput,
  ): Promise<UploadUrlDto> {
    return this.meals.uploadUrl(userId, input);
  }

  /** Step 2: create from a photo key or text and analyse it. 202 while queued, 201 when done inline. */
  @Post("meals")
  async create(
    @UserId() userId: string,
    @ZodBody(CreateMealSchema) input: CreateMealInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<CreateMealDto> {
    const { status, body } = await this.meals.create(userId, input);
    res.status(status);
    return wire(body);
  }

  @Get("meals")
  list(@UserId() userId: string, @Query("date") date?: string): Promise<MealListDto> {
    return wire(this.meals.list(userId, date));
  }

  /** Meals this user logs most often (design 7b "Your usuals"). */
  @Get("meals/usuals")
  async usualMeals(@UserId() userId: string): Promise<UsualsDto> {
    return { usuals: await this.usuals.getUsuals(userId) };
  }

  /** Describe something to add to a meal ("2 sachets sugar") and get priced items back. Nothing is saved. */
  @Post("meals/parse-items")
  @HttpCode(200)
  parseItems(
    @UserId() userId: string,
    @ZodBody(ParseItemsSchema) input: ParseItemsInput,
  ): Promise<ParsedItemsDto> {
    return this.meals.parseItems(userId, input);
  }

  /** Log known foods as one confirmed meal (e.g. the pre-workout snack). */
  @Post("meals/log-items")
  logItems(
    @UserId() userId: string,
    @ZodBody(LogItemsSchema) input: LogItemsInput,
  ): Promise<CreatedDto> {
    return this.meals.logItems(userId, input);
  }

  /** Log one known food straight to a meal (barcode product "Add to snack"). */
  @Post("meals/quick-add")
  quickAdd(
    @UserId() userId: string,
    @ZodBody(QuickAddSchema) input: QuickAddInput,
  ): Promise<CreatedDto> {
    return this.meals.quickAdd(userId, input);
  }

  /** One-tap relog of a usual into today. */
  @Post("meals/relog")
  relog(
    @UserId() userId: string,
    @ZodBody(RelogSchema) { mealId, mealType }: RelogInput,
  ): Promise<CreatedDto> {
    return this.meals.relog(userId, mealId, mealType);
  }

  /** Poll this while status is PENDING/ANALYZING. */
  @Get("meals/:id")
  get(@UserId() userId: string, @Param("id") id: string): Promise<MealDetailDto> {
    return wire(this.meals.get(userId, id));
  }

  /** Step 3: the user confirms or edits the detected items. */
  @Put("meals/:id")
  confirm(
    @UserId() userId: string,
    @Param("id") id: string,
    @ZodBody(ConfirmMealSchema) input: ConfirmMealInput,
  ): Promise<MealLogDto> {
    return wire(this.meals.confirm(userId, id, input));
  }

  @Delete("meals/:id")
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param("id") id: string) {
    await this.meals.remove(userId, id);
  }

  /** Re-run the AI, optionally with the user's details. 202 while queued, 200 when done inline. */
  @Post("meals/:id/recheck")
  async recheck(
    @UserId() userId: string,
    @Param("id") id: string,
    @ZodBody(RecheckSchema) input: RecheckInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<RecheckDto> {
    const { status, body } = await this.meals.recheck(userId, id, input);
    res.status(status);
    return body;
  }
}
