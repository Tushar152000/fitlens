import { Controller, Get, HttpCode, Post } from "@nestjs/common";
import {
  GoalOptionSchema,
  OnboardingSchema,
  WelcomeBackSchema,
  type GoalOptionDto,
  type GoalOptionInput,
  type OnboardingInput,
  type PlanDto,
  type PlanSummaryDto,
  type TargetsDto,
  type WelcomeBackDto,
  type WelcomeBackInput,
} from "@fitr8/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { ZodBody } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { PlanService } from "./plan.service.js";

/** Thin HTTP adapter: auth + validation here, rules in PlanService / TargetsService. */
@Controller()
export class PlanController {
  constructor(private readonly plans: PlanService) {}

  /** Save profile, first body metric and goal; returns the "Your plan" summary. */
  @Post("onboarding")
  onboard(
    @UserId() userId: string,
    @ZodBody(OnboardingSchema) input: OnboardingInput,
  ): Promise<PlanSummaryDto> {
    return wire(this.plans.onboard(userId, input));
  }

  /** Back after 90+ days away: refresh the numbers that change, keep the goal, recompute targets. */
  @Post("welcome-back")
  @HttpCode(200)
  welcomeBack(
    @UserId() userId: string,
    @ZodBody(WelcomeBackSchema) input: WelcomeBackInput,
  ): Promise<WelcomeBackDto> {
    return wire(this.plans.welcomeBack(userId, input));
  }

  @Get("targets")
  targets(@UserId() userId: string): Promise<TargetsDto> {
    return wire(this.plans.todayTarget(userId));
  }

  /** Screen 5 data: summary, active goal, latest metric, training settings. */
  @Get("plan")
  plan(@UserId() userId: string): Promise<PlanDto> {
    return wire(this.plans.getPlan(userId));
  }

  /** Design 5b: pick a safer date or a closer target. */
  @Post("goal/option")
  @HttpCode(200)
  goalOption(
    @UserId() userId: string,
    @ZodBody(GoalOptionSchema) input: GoalOptionInput,
  ): Promise<GoalOptionDto> {
    return wire(this.plans.chooseGoalOption(userId, input));
  }
}
