import { Global, Module } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import { ENV, type Env } from "../../config/config.module.js";
import { ANTHROPIC, createAnthropic } from "./anthropic.client.js";
import { ClaudeExtractor } from "./extraction/claude.extractor.js";
import { MockExtractor } from "./extraction/mock.extractor.js";
import { FOOD_EXTRACTOR } from "./extraction/types.js";

/**
 * Model access. The only module that knows a vendor SDK exists. AI_PROVIDER=mock swaps in
 * deterministic fakes so dev, tests and CI run without a key.
 */
@Global()
@Module({
  providers: [
    { provide: ANTHROPIC, inject: [ENV], useFactory: createAnthropic },
    {
      provide: FOOD_EXTRACTOR,
      inject: [ENV, ANTHROPIC],
      useFactory: (env: Env, client: Anthropic | null) =>
        client ? new ClaudeExtractor(client, env.AI_EXTRACTION_MODEL) : new MockExtractor(),
    },
  ],
  exports: [ANTHROPIC, FOOD_EXTRACTOR],
})
export class AiModule {}
