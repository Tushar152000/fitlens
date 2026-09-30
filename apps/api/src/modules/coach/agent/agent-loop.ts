import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, BetaMessageParam, ModelGateway } from "./model-gateway.js";
import { serializeToolResult, toApiTools, type AgentTool } from "./tool.js";

export type AgentEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; id: string; name: string; label: string; status: "running" | "done" | "error" };

/**
 * One persisted unit of the transcript. An assistant turn that calls tools is only ever emitted together
 * with its tool results, so the stored conversation is always a valid prefix for the next request.
 */
export interface AgentStep {
  messages: BetaMessageParam[];
  /** Assistant-visible text produced in this step. */
  text: string;
  /** Labels of tools that ran successfully in this step. */
  actions: string[];
  response: BetaMessage;
  latencyMs: number;
}

export type AgentOutcome =
  | { status: "completed" }
  | { status: "refused" }
  | { status: "aborted" }
  | { status: "failed"; reason: "max_tokens" | "context_window" | "invalid_tool_json" };

export interface AgentRunInput {
  gateway: ModelGateway;
  system: Anthropic.Beta.BetaTextBlockParam[];
  tools: AgentTool<unknown>[];
  /** Full transcript so far, ending with the new user turn. Never mutated. */
  history: BetaMessageParam[];
  /** Model requests per user turn. The last one runs with tool_choice "none" so the turn always ends in text. */
  maxIterations?: number;
  signal: AbortSignal;
  onEvent: (event: AgentEvent) => void;
  /** Called after each complete step; persist it before the next model request. */
  onStep: (step: AgentStep) => Promise<void>;
  /** Called after every model request (success or failure) for usage accounting. */
  onModelCall?: (call: {
    response?: BetaMessage;
    latencyMs: number;
    error?: unknown;
  }) => Promise<void>;
}

const MAX_JSON_RETRIES = 2;

/**
 * The agentic loop: request → stream text → run requested tools in parallel → feed results back → repeat
 * until the model ends its turn. Follows the Claude tool-use contract:
 *  - every tool_use gets exactly one tool_result, all in a single user message (parallel calls)
 *  - tool inputs are schema-validated before running; failures go back as `is_error` results
 *  - `refusal` and `max_tokens` never run that turn's tools
 *  - `pause_turn` / `compaction` are continued by re-sending with the assistant turn appended
 */
export async function runAgent(input: AgentRunInput): Promise<AgentOutcome> {
  const { gateway, system, signal, onEvent, onStep } = input;
  const maxIterations = input.maxIterations ?? 8;
  const apiTools = toApiTools(input.tools);
  const toolsByName = new Map(input.tools.map((t) => [t.name, t] as const));
  const transcript = [...input.history];
  let jsonRetries = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    if (signal.aborted) return { status: "aborted" };
    const started = Date.now();
    let text = "";
    let response: BetaMessage;
    try {
      response = await gateway.createTurn(
        {
          system,
          tools: apiTools,
          messages: transcript,
          toolChoice: iteration === maxIterations - 1 ? "none" : "auto",
        },
        {
          signal,
          onTextDelta: (delta) => {
            text += delta;
            onEvent({ type: "text", delta });
          },
        },
      );
    } catch (error) {
      await input.onModelCall?.({ latencyMs: Date.now() - started, error });
      if (signal.aborted) return { status: "aborted" };
      // With eager input streaming, unparseable tool JSON rejects the stream. Re-issue the same turn;
      // API errors (auth, rate limit after SDK retries, 5xx) are real failures and propagate.
      if (!(error instanceof Anthropic.APIError) && jsonRetries++ < MAX_JSON_RETRIES) {
        iteration--;
        continue;
      }
      if (!(error instanceof Anthropic.APIError))
        return { status: "failed", reason: "invalid_tool_json" };
      throw error;
    }
    jsonRetries = 0;
    const latencyMs = Date.now() - started;
    await input.onModelCall?.({ response, latencyMs });

    const assistant: BetaMessageParam = { role: "assistant", content: response.content };
    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use",
    );

    switch (response.stop_reason) {
      case "refusal":
        // Server-side fallbacks already tried other models; don't store a refused turn.
        return { status: "refused" };
      case "model_context_window_exceeded":
        return { status: "failed", reason: "context_window" };
      case "max_tokens":
        // A cut-off tool input can still look valid — never run it. Plain text is kept as-is.
        if (toolUses.length) return { status: "failed", reason: "max_tokens" };
        await onStep({ messages: [assistant], text, actions: [], response, latencyMs });
        return { status: "completed" };
      case "pause_turn":
      case "compaction":
        transcript.push(assistant);
        await onStep({ messages: [assistant], text, actions: [], response, latencyMs });
        continue;
      case "tool_use": {
        if (!toolUses.length) break;
        const results = await Promise.all(
          toolUses.map((use) => runTool(toolsByName, use, onEvent, signal)),
        );
        if (signal.aborted) return { status: "aborted" };
        const toolMessage: BetaMessageParam = {
          role: "user",
          content: results.map((r) => r.block),
        };
        transcript.push(assistant, toolMessage);
        await onStep({
          messages: [assistant, toolMessage],
          text,
          actions: results.filter((r) => r.ok).map((r) => r.label),
          response,
          latencyMs,
        });
        continue;
      }
    }

    // end_turn, stop_sequence, or a tool_use stop with no tool calls.
    await onStep({ messages: [assistant], text, actions: [], response, latencyMs });
    return { status: "completed" };
  }
  return { status: "completed" };
}

async function runTool(
  tools: Map<string, AgentTool<unknown>>,
  use: Anthropic.Beta.BetaToolUseBlock,
  onEvent: (e: AgentEvent) => void,
  signal: AbortSignal,
): Promise<{ ok: boolean; label: string; block: Anthropic.Beta.BetaToolResultBlockParam }> {
  const tool = tools.get(use.name);
  const label = tool?.label ?? use.name;
  const fail = (message: string) => {
    onEvent({ type: "tool", id: use.id, name: use.name, label, status: "error" });
    return {
      ok: false,
      label,
      block: {
        type: "tool_result" as const,
        tool_use_id: use.id,
        is_error: true,
        content: message,
      },
    };
  };
  if (!tool) return fail(`Unknown tool "${use.name}"`);

  const parsed = (tool.input as AgentTool["input"]).safeParse(use.input ?? {});
  if (!parsed.success) {
    return fail(
      `Invalid input: ${parsed.error.issues.map((i) => `${i.path.join(".") || "input"} ${i.message}`).join("; ")}`,
    );
  }

  onEvent({ type: "tool", id: use.id, name: use.name, label, status: "running" });
  try {
    if (signal.aborted) throw new Error("aborted");
    const output = await (tool as AgentTool).run(parsed.data);
    onEvent({ type: "tool", id: use.id, name: use.name, label, status: "done" });
    return {
      ok: true,
      label,
      block: { type: "tool_result", tool_use_id: use.id, content: serializeToolResult(output) },
    };
  } catch (err) {
    // Expected failures (e.g. "Finish onboarding first") are useful to the model; internals are not.
    const message =
      err instanceof Error && "status" in err
        ? err.message
        : "The tool failed. Try another approach.";
    return fail(message);
  }
}
