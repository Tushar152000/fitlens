import { Module } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import { ANTHROPIC } from "../ai/anthropic.client.js";
import { AI_MODELS } from "../ai/models.js";
import { OPENAI } from "../ai/openai.client.js";
import { FoodsModule } from "../foods/foods.module.js";
import { MealsModule } from "../meals/meals.module.js";
import { ProgressModule } from "../progress/progress.module.js";
import { WaterModule } from "../water/water.module.js";
import { WorkoutsModule } from "../workouts/workouts.module.js";
import { ClaudeGateway } from "./agent/claude.gateway.js";
import { MockGateway } from "./agent/mock.gateway.js";
import { MODEL_GATEWAY } from "./agent/model-gateway.js";
import { OpenAiGateway } from "./agent/openai.gateway.js";
import { CoachController } from "./coach.controller.js";
import { CoachService } from "./coach.service.js";
import { CoachToolbox } from "./tools/coach-toolbox.js";
import { TurnLock } from "./turn-lock.js";

/** The AI coach: an agent loop (Claude or OpenAI) whose tools are the other modules' application services. */
@Module({
  imports: [ProgressModule, WorkoutsModule, WaterModule, MealsModule, FoodsModule],
  controllers: [CoachController],
  providers: [
    CoachService,
    CoachToolbox,
    TurnLock,
    {
      provide: MODEL_GATEWAY,
      inject: [ANTHROPIC, OPENAI],
      useFactory: (anthropic: Anthropic | null, openai: OpenAI | null) => {
        const { anthropic: claude, openai: gpt } = AI_MODELS;
        if (anthropic) return new ClaudeGateway(anthropic, claude.coach, claude.coachEffort);
        if (openai) return new OpenAiGateway(openai, gpt.coach, gpt.coachEffort);
        return new MockGateway();
      },
    },
  ],
})
export class CoachModule {}
