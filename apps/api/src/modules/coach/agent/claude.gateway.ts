import type Anthropic from "@anthropic-ai/sdk";
import { FALLBACK_BETA } from "../../ai/anthropic.client.js";
import type {
  BetaMessage,
  ModelGateway,
  ModelTurnOptions,
  ModelTurnRequest,
} from "./model-gateway.js";

const COMPACTION_BETA = "compact-2026-01-12";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Claude over the streaming Messages API.
 *
 * Context strategy:
 *  - prompt caching: a breakpoint on the frozen system prompt caches tools + system; top-level automatic
 *    caching moves a second breakpoint along the growing conversation tail
 *  - server-side compaction summarizes old turns when the thread nears the context limit; the returned
 *    compaction block is stored verbatim and replayed, replacing what it summarized
 *  - adaptive thinking (default on this model) with an explicit effort level
 *  - refusal fallbacks routed server-side
 */
export class ClaudeGateway implements ModelGateway {
  readonly provider = "anthropic";

  constructor(
    private readonly client: Anthropic,
    readonly model: string,
    private readonly effort: Effort,
  ) {}

  async createTurn(
    req: ModelTurnRequest,
    { signal, onTextDelta }: ModelTurnOptions,
  ): Promise<BetaMessage> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: 32_000,
        betas: [FALLBACK_BETA, COMPACTION_BETA],
        fallbacks: "default",
        system: req.system,
        tools: req.tools,
        tool_choice: { type: req.toolChoice },
        messages: req.messages,
        cache_control: { type: "ephemeral" },
        output_config: { effort: this.effort },
        context_management: { edits: [{ type: "compact_20260112" }] },
      },
      { signal },
    );
    stream.on("text", onTextDelta);
    return stream.finalMessage();
  }
}
