import { Module } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import { ENV, type Env } from "../../config/config.module.js";
import { ANTHROPIC } from "../ai/anthropic.client.js";
import { FoodsModule } from "../foods/foods.module.js";
import { MealsModule } from "../meals/meals.module.js";
import { ProgressModule } from "../progress/progress.module.js";
import { WaterModule } from "../water/water.module.js";
import { WorkoutsModule } from "../workouts/workouts.module.js";
import { ClaudeGateway } from "./agent/claude.gateway.js";
import { MockGateway } from "./agent/mock.gateway.js";
import { MODEL_GATEWAY } from "./agent/model-gateway.js";
import { CoachController } from "./coach.controller.js";
import { CoachService } from "./coach.service.js";
import { CoachToolbox } from "./tools/coach-toolbox.js";
import { TurnLock } from "./turn-lock.js";

/** The AI coach: a Claude agent loop whose tools are the other modules' application services. */
@Module({
  imports: [ProgressModule, WorkoutsModule, WaterModule, MealsModule, FoodsModule],
  controllers: [CoachController],
  providers: [
    CoachService,
    CoachToolbox,
    TurnLock,
    {
      provide: MODEL_GATEWAY,
      inject: [ENV, ANTHROPIC],
      useFactory: (env: Env, client: Anthropic | null) =>
        client
          ? new ClaudeGateway(client, env.AI_COACH_MODEL, env.AI_COACH_EFFORT)
          : new MockGateway(),
    },
  ],
})
export class CoachModule {}
