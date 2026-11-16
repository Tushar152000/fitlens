import { Global, Module } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import type OpenAI from "openai";
import { ENV } from "../../config/config.module.js";
import { ANTHROPIC, createAnthropic } from "./anthropic.client.js";
import { ClaudeExtractor } from "./extraction/claude.extractor.js";
import { MockExtractor } from "./extraction/mock.extractor.js";
import { OpenAiExtractor } from "./extraction/openai.extractor.js";
import { FOOD_EXTRACTOR } from "./extraction/types.js";
import { AI_MODELS } from "./models.js";
import { OPENAI, createOpenAI } from "./openai.client.js";

/**
 * Model access. The only module that knows a vendor SDK exists. AI_PROVIDER picks Claude or OpenAI;
 * `mock` swaps in deterministic fakes so dev, tests and CI run without a key.
 */
@Global()
@Module({
  providers: [
    { provide: ANTHROPIC, inject: [ENV], useFactory: createAnthropic },
    { provide: OPENAI, inject: [ENV], useFactory: createOpenAI },
    {
      provide: FOOD_EXTRACTOR,
      inject: [ANTHROPIC, OPENAI],
      useFactory: (anthropic: Anthropic | null, openai: OpenAI | null) => {
        if (anthropic) return new ClaudeExtractor(anthropic, AI_MODELS.anthropic.extraction);
        if (openai) return new OpenAiExtractor(openai, AI_MODELS.openai.extraction);
        return new MockExtractor();
      },
    },
  ],
  exports: [ANTHROPIC, OPENAI, FOOD_EXTRACTOR],
})
export class AiModule {}
