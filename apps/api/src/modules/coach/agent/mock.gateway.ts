import type Anthropic from "@anthropic-ai/sdk";
import { randomUUID } from "node:crypto";
import type {
  BetaMessage,
  BetaMessageParam,
  ModelGateway,
  ModelTurnOptions,
  ModelTurnRequest,
} from "./model-gateway.js";

/**
 * A scripted stand-in for Claude (AI_PROVIDER=mock) so the full agent loop — tools, streaming, persistence —
 * runs in dev, e2e tests and CI without an API key. It picks one tool from keywords, then summarizes the result.
 */
export class MockGateway implements ModelGateway {
  readonly provider = "mock";
  readonly model = "mock-coach";

  async createTurn(req: ModelTurnRequest, { onTextDelta }: ModelTurnOptions): Promise<BetaMessage> {
    const last = req.messages.at(-1);
    const toolResult = Array.isArray(last?.content)
      ? last.content.find(
          (b): b is Anthropic.Beta.BetaToolResultBlockParam => b.type === "tool_result",
        )
      : undefined;

    if (toolResult || req.toolChoice === "none") {
      const summary = toolResult?.is_error ? "I couldn't get that just now" : "Here's what I found";
      const text = `${summary}. (Mock coach: set AI_PROVIDER=anthropic for real coaching.)`;
      for (const word of text.split(/(?<= )/)) onTextDelta(word);
      return message([{ type: "text", text, citations: null }], "end_turn");
    }

    const userText = lastUserText(last);
    const call = pickTool(userText, new Set(req.tools.map((t) => t.name)));
    return message(
      [
        {
          type: "tool_use",
          id: `toolu_${randomUUID().replace(/-/g, "").slice(0, 20)}`,
          name: call.name,
          input: call.input,
          caller: { type: "direct" },
        } as Anthropic.Beta.BetaToolUseBlock,
      ],
      "tool_use",
    );
  }
}

function lastUserText(msg: BetaMessageParam | undefined): string {
  if (!msg) return "";
  if (typeof msg.content === "string") return msg.content;
  return (
    msg.content
      .filter((b): b is Anthropic.Beta.BetaTextBlockParam => b.type === "text")
      .map((b) => b.text)
      .at(-1) ?? ""
  );
}

function pickTool(
  text: string,
  available: Set<string>,
): { name: string; input: Record<string, unknown> } {
  const t = text.toLowerCase();
  const ml = t.match(/(\d{2,4})\s*ml/);
  const kg = t.match(/(\d{2,3}(?:\.\d)?)\s*kg/);
  const candidates: { name: string; input: Record<string, unknown> }[] = [];
  if (ml && /water|drank|glass/.test(t))
    candidates.push({ name: "log_water", input: { ml: Number(ml[1]) } });
  if (kg && /weigh/.test(t))
    candidates.push({ name: "log_weigh_in", input: { weightKg: Number(kg[1]) } });
  if (/workout|train|gym|session/.test(t))
    candidates.push({ name: "get_workout_today", input: {} });
  if (/week|history|last \d+ days/.test(t))
    candidates.push({ name: "get_history", input: { days: 7 } });
  candidates.push({ name: "get_today_overview", input: {} });
  return candidates.find((c) => available.has(c.name)) ?? candidates.at(-1)!;
}

function message(
  content: Anthropic.Beta.BetaContentBlock[],
  stop: Anthropic.Beta.BetaStopReason,
): BetaMessage {
  return {
    id: `msg_mock_${randomUUID()}`,
    type: "message",
    role: "assistant",
    model: "mock-coach",
    content,
    stop_reason: stop,
    stop_sequence: null,
    usage: {
      input_tokens: 0,
      output_tokens: 0,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  } as unknown as BetaMessage;
}
