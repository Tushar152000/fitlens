import type Anthropic from "@anthropic-ai/sdk";
import { z, type ZodType } from "zod";

/**
 * A capability the agent can use. The model only ever sees `name`, `description` and the input schema;
 * `run` executes server-side with the caller's identity already bound (see CoachToolbox), so a tool
 * can never be pointed at another user's data.
 */
export interface AgentTool<I = unknown> {
  name: string;
  /** Present-tense status shown to the user while it runs, e.g. "Checking today's meals". */
  label: string;
  description: string;
  input: ZodType<I>;
  run(input: I): Promise<unknown>;
}

export function defineTool<I>(tool: AgentTool<I>): AgentTool<I> {
  return tool;
}

/** Deterministic tool schemas (stable order, stable JSON) keep the tools prefix byte-identical → cache hits. */
export function toApiTools(tools: AgentTool<unknown>[]): Anthropic.Beta.BetaTool[] {
  return tools.map((t) => {
    const { $schema: _ignored, ...schema } = z.toJSONSchema(t.input as ZodType, {
      io: "input",
    }) as Record<string, unknown>;
    return {
      name: t.name,
      description: t.description,
      input_schema: schema as Anthropic.Beta.BetaTool.InputSchema,
      // Tool inputs stream as they are generated; the loop validates every input before running it.
      eager_input_streaming: true,
    };
  });
}

/** Tool output as the model will read it: compact JSON, capped so one tool can't flood the context. */
export function serializeToolResult(value: unknown, maxChars = 12_000): string {
  const json = JSON.stringify(value ?? null, (_key, v: unknown) =>
    v instanceof Date ? v.toISOString() : v,
  );
  return json.length > maxChars ? `${json.slice(0, maxChars)}…(truncated)` : json;
}
