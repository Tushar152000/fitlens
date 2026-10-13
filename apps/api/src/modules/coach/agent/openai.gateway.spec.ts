import OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { runAgent, type AgentStep } from "./agent-loop.js";
import { ModelRequestError, type BetaMessageParam } from "./model-gateway.js";
import { OpenAiGateway, toInput } from "./openai.gateway.js";
import { defineTool, toApiTools, type AgentTool } from "./tool.js";

type Output = OpenAI.Responses.ResponseOutputItem;
const say = (text: string) =>
  ({
    type: "message",
    id: "m",
    role: "assistant",
    status: "completed",
    content: [{ type: "output_text", text, annotations: [] }],
  }) as unknown as Output;
const call = (callId: string, name: string, args: string) =>
  ({ type: "function_call", call_id: callId, name, arguments: args }) as Output;
const response = (
  output: Output[],
  extra: Partial<OpenAI.Responses.Response> = {},
): OpenAI.Responses.Response =>
  ({
    id: "resp",
    model: "gpt-test",
    status: "completed",
    output,
    incomplete_details: null,
    error: null,
    usage: {
      input_tokens: 100,
      input_tokens_details: { cached_tokens: 60, cache_write_tokens: 0 },
      output_tokens: 7,
      output_tokens_details: { reasoning_tokens: 0 },
      total_tokens: 107,
    },
    ...extra,
  }) as OpenAI.Responses.Response;

/** A fake client: replays scripted responses, streams their text as deltas, records each request. */
function fakeOpenAi(...script: (OpenAI.Responses.Response | Error)[]) {
  const requests: Record<string, unknown>[] = [];
  const client = {
    responses: {
      stream(params: Record<string, unknown>) {
        requests.push(structuredClone(params));
        let onDelta: (e: { delta: string }) => void = () => {};
        return {
          on(_event: string, cb: (e: { delta: string }) => void) {
            onDelta = cb;
            return this;
          },
          async finalResponse() {
            const next = script.shift();
            if (!next) throw new Error("script exhausted");
            if (next instanceof Error) throw next;
            for (const item of next.output)
              if (item.type === "message")
                for (const part of item.content)
                  if (part.type === "output_text") onDelta({ delta: part.text });
            return next;
          },
        };
      },
    },
  } as unknown as OpenAI;
  return { gateway: new OpenAiGateway(client, "gpt-test", "medium"), requests };
}

const add = defineTool({
  name: "add",
  label: "Adding",
  description: "Adds two numbers",
  input: z.object({ a: z.number(), b: z.number() }),
  run: async ({ a, b }) => ({ sum: a + b }),
}) as AgentTool<unknown>;

const turn = (gateway: OpenAiGateway, toolChoice: "auto" | "none" = "auto") =>
  gateway.createTurn(
    {
      system: [{ type: "text", text: "sys" }],
      tools: toApiTools([add]),
      messages: [{ role: "user", content: "hi" }],
      toolChoice,
    },
    { signal: new AbortController().signal, onTextDelta: () => {} },
  );

describe("OpenAiGateway", () => {
  it("translates the Claude transcript into Responses input", () => {
    const history: BetaMessageParam[] = [
      { role: "user", content: "what is 2+3?" },
      {
        role: "assistant",
        content: [
          { type: "thinking", thinking: "…", signature: "s" },
          { type: "text", text: "Let me add." },
          { type: "tool_use", id: "c1", name: "add", input: { a: 2, b: 3 } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "c1", content: '{"sum":5}' },
          { type: "tool_result", tool_use_id: "c2", content: "boom", is_error: true },
        ],
      },
    ];
    expect(toInput(history)).toEqual([
      { role: "user", content: "what is 2+3?" },
      { type: "function_call", call_id: "c1", name: "add", arguments: '{"a":2,"b":3}' },
      { role: "assistant", content: "Let me add." },
      { type: "function_call_output", call_id: "c1", output: '{"sum":5}' },
      { type: "function_call_output", call_id: "c2", output: "Error: boom" },
    ]);
  });

  it("sends instructions, function tools and tool choice", async () => {
    const { gateway, requests } = fakeOpenAi(response([say("ok")]));
    await turn(gateway, "none");
    expect(requests[0]).toMatchObject({
      model: "gpt-test",
      store: false,
      instructions: "sys",
      reasoning: { effort: "medium" },
      tool_choice: "none",
      tools: [{ type: "function", name: "add", strict: false }],
    });
  });

  it("maps function calls to tool_use with Claude-shaped usage", async () => {
    const { gateway } = fakeOpenAi(response([say("Adding"), call("c1", "add", '{"a":1,"b":2}')]));
    const msg = await turn(gateway);
    expect(msg.stop_reason).toBe("tool_use");
    expect(msg.content).toEqual([
      { type: "text", text: "Adding", citations: null },
      { type: "tool_use", id: "c1", name: "add", input: { a: 1, b: 2 } },
    ]);
    expect(msg.usage).toMatchObject({
      input_tokens: 40,
      output_tokens: 7,
      cache_read_input_tokens: 60,
    });
  });

  it("maps truncation and content filtering to Claude stop reasons", async () => {
    const { gateway } = fakeOpenAi(
      response([say("cut")], { incomplete_details: { reason: "max_output_tokens" } }),
      response([], { incomplete_details: { reason: "content_filter" } }),
    );
    expect((await turn(gateway)).stop_reason).toBe("max_tokens");
    expect((await turn(gateway)).stop_reason).toBe("refusal");
  });

  it("wraps API errors so the loop propagates them instead of retrying", async () => {
    const { gateway } = fakeOpenAi(
      new OpenAI.APIError(401, { message: "bad key" }, "bad key", new Headers()),
    );
    await expect(turn(gateway)).rejects.toBeInstanceOf(ModelRequestError);
  });

  it("runs a full tool round trip through the agent loop", async () => {
    const { gateway, requests } = fakeOpenAi(
      response([call("c1", "add", '{"a":2,"b":3}')]),
      response([say("2 + 3 = 5")]),
    );
    const steps: AgentStep[] = [];
    const outcome = await runAgent({
      gateway,
      system: [{ type: "text", text: "sys" }],
      tools: [add],
      history: [{ role: "user", content: "add 2 and 3" }],
      signal: new AbortController().signal,
      onEvent: () => {},
      onStep: async (s) => {
        steps.push(s);
      },
    });
    expect(outcome).toEqual({ status: "completed" });
    expect(steps.map((s) => s.actions)).toEqual([["Adding"], []]);
    expect(requests[1]!.input).toContainEqual({
      type: "function_call_output",
      call_id: "c1",
      output: '{"sum":5}',
    });
  });

  it("re-issues the turn when tool arguments are not valid JSON", async () => {
    const { gateway, requests } = fakeOpenAi(
      response([call("c1", "add", '{"a":2,')]),
      response([say("done")]),
    );
    const outcome = await runAgent({
      gateway,
      system: [{ type: "text", text: "sys" }],
      tools: [add],
      history: [{ role: "user", content: "add" }],
      signal: new AbortController().signal,
      onEvent: () => {},
      onStep: async () => {},
    });
    expect(outcome).toEqual({ status: "completed" });
    expect(requests).toHaveLength(2);
  });
});
