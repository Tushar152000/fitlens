import { Controller, Get, Post, Query } from "@nestjs/common";
import {
  EnergySchema,
  WorkoutLogSchema,
  type GeneratedPlanDto,
  type TodayWorkoutDto,
  type WorkoutLogInput,
  type WorkoutLogResultDto,
} from "@fitr8/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { ZodBody } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { WorkoutsService } from "./workouts.service.js";

/** Thin HTTP adapter: auth + validation here, the training engine behind WorkoutsService. */
@Controller("workouts")
export class WorkoutsController {
  constructor(private readonly workouts: WorkoutsService) {}

  /** GET /api/workouts/today?energy=great|ok|tired → today's session with daily adjustments. */
  @Get("today")
  today(@UserId() userId: string, @Query("energy") energy?: string): Promise<TodayWorkoutDto> {
    // An unknown energy value falls back to "ok" rather than failing the screen.
    return this.workouts.getToday(userId, EnergySchema.catch("ok").parse(energy ?? "ok"));
  }

  /** Save one exercise's sets for today; returns the next target for that exercise. */
  @Post("logs")
  log(
    @UserId() userId: string,
    @ZodBody(WorkoutLogSchema) input: WorkoutLogInput,
  ): Promise<WorkoutLogResultDto> {
    return this.workouts.log(userId, input);
  }

  /** Build (or rebuild as a new version) this week's plan with the coach engine. */
  @Post("generate")
  generate(@UserId() userId: string): Promise<GeneratedPlanDto> {
    return wire(this.workouts.generate(userId));
  }
}
