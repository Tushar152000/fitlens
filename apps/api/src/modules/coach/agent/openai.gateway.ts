import type Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import {
  ModelRequestError,
  type BetaMessage,
  type BetaMessageParam,
  type ModelGateway,
  type ModelTurnOptions,
  type ModelTurnRequest,
} from "./model-gateway.js";

type Effort = "low" | "medium" | "high" | "xhigh" | "max";
type InputItem = OpenAI.Responses.ResponseInputItem;

/**
 * OpenAI over the streaming Responses API, behind the same port as Claude.
 *
 * The transcript stays in the Claude message shape (what the loop and `CoachMessage.content` use), so
 * each request is translated: system → instructions, tool_use/tool_result → function_call/
 * function_call_output, and the response back into a Claude-shaped message. Claude-only blocks
 * (thinking, compaction) are skipped. Requests are stateless (`store: false`); the stable
 * instructions + tools prefix is cached by OpenAI automatically, keyed by `prompt_cache_key`.
 */
export class OpenAiGateway implements ModelGateway {
  readonly provider = "openai";

  constructor(
    private readonly client: OpenAI,
    readonly model: string,
    private readonly effort: Effort,
  ) {}

  async createTurn(
    req: ModelTurnRequest,
    { signal, onTextDelta }: ModelTurnOptions,
  ): Promise<BetaMessage> {
    let response: OpenAI.Responses.Response;
    try {
      const stream = this.client.responses.stream(
        {
          model: this.model,
          max_output_tokens: 32_000,
          store: false,
          prompt_cache_key: "fitr8-coach",
          reasoning: { effort: this.effort },
          instructions: req.system.map((b) => b.text).join("\n\n"),
          input: toInput(req.messages),
          ...(req.tools.length && {
            tools: req.tools.map(toFunctionTool),
            tool_choice: req.toolChoice,
          }),
        },
        { signal },
      );
      stream.on("response.output_text.delta", (e) => onTextDelta(e.delta));
      response = await stream.finalResponse();
    } catch (error) {
      if (error instanceof OpenAI.APIError)
        throw new ModelRequestError(error.message, { cause: error });
      throw error;
    }
    if (response.status === "failed")
      throw new ModelRequestError(response.error?.message ?? "OpenAI request failed");
    return toBetaMessage(response);
  }
}

function toFunctionTool(tool: Anthropic.Beta.BetaTool): OpenAI.Responses.FunctionTool {
  return {
    type: "function",
    name: tool.name,
    description: tool.description ?? null,
    parameters: tool.input_schema as Record<string, unknown>,
    // Strict mode requires every property to be required; the loop validates inputs with Zod instead.
    strict: false,
  };
}

/** Claude transcript → Responses input items. Tool outputs precede any text of the same user turn. */
export function toInput(messages: BetaMessageParam[]): InputItem[] {
  const items: InputItem[] = [];
  for (const msg of messages) {
    if (typeof msg.content === "string") {
      items.push({ role: msg.role, content: msg.content });
      continue;
    }
    const text: string[] = [];
    for (const block of msg.content) {
      if (block.type === "text") text.push(block.text);
      else if (block.type === "tool_use")
        items.push({
          type: "function_call",
          call_id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input ?? {}),
        });
      else if (block.type === "tool_result")
        items.push({
          type: "function_call_output",
          call_id: block.tool_use_id,
          output: `${block.is_error ? "Error: " : ""}${resultText(block.content)}`,
        });
    }
    if (text.length) items.push({ role: msg.role, content: text.join("\n\n") });
  }
  return items;
}

function resultText(content: Anthropic.Beta.BetaToolResultBlockParam["content"]): string {
  if (content == null) return "";
  if (typeof content === "string") return content;
  return content.map((part) => (part.type === "text" ? part.text : "")).join("");
}

/** Responses output → the Claude-shaped message the loop and persistence expect. */
export function toBetaMessage(res: OpenAI.Responses.Response): BetaMessage {
  const content: Anthropic.Beta.BetaContentBlock[] = [];
  let refused = false;
  for (const item of res.output) {
    if (item.type === "message") {
      for (const part of item.content) {
        if (part.type === "output_text")
          content.push({ type: "text", text: part.text, citations: null });
        else if (part.type === "refusal") refused = true;
      }
    } else if (item.type === "function_call") {
      // Unparseable arguments throw a plain Error: the loop re-issues the turn, as with Claude.
      const input: unknown = JSON.parse(item.arguments || "{}");
      content.push({
        type: "tool_use",
        id: item.call_id,
        name: item.name,
        input,
      } as Anthropic.Beta.BetaToolUseBlock);
    }
  }

  const incomplete = res.incomplete_details?.reason;
  const stopReason: BetaMessage["stop_reason"] =
    refused || incomplete === "content_filter"
      ? "refusal"
      : incomplete === "max_output_tokens"
        ? "max_tokens"
        : content.some((b) => b.type === "tool_use")
          ? "tool_use"
          : "end_turn";

  const cached = res.usage?.input_tokens_details?.cached_tokens ?? 0;
  return {
    id: res.id,
    type: "message",
    role: "assistant",
    model: res.model,
    content,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: (res.usage?.input_tokens ?? 0) - cached,
      output_tokens: res.usage?.output_tokens ?? 0,
      cache_read_input_tokens: cached,
      cache_creation_input_tokens: 0,
    },
  } as unknown as BetaMessage;
}
