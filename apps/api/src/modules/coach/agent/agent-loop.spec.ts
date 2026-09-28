import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { runAgent, type AgentEvent, type AgentStep } from "./agent-loop.js";
import type { BetaMessage, ModelGateway, ModelTurnRequest } from "./model-gateway.js";
import { defineTool, serializeToolResult, toApiTools, type AgentTool } from "./tool.js";

type Block = Anthropic.Beta.BetaContentBlock;
const text = (t: string) => ({ type: "text", text: t, citations: null }) as Block;
const toolUse = (id: string, name: string, input: unknown) =>
  ({ type: "tool_use", id, name, input }) as Block;
const msg = (content: Block[], stop: Anthropic.Beta.BetaStopReason): BetaMessage =>
  ({
    id: "msg",
    type: "message",
    role: "assistant",
    model: "test",
    content,
    stop_reason: stop,
    usage: {
      input_tokens: 10,
      output_tokens: 5,
      cache_read_input_tokens: 0,
      cache_creation_input_tokens: 0,
    },
  }) as unknown as BetaMessage;

/** Replays scripted responses, streaming each text block as one delta, and records every request. */
function scripted(...responses: (BetaMessage | Error)[]) {
  const requests: ModelTurnRequest[] = [];
  const gateway: ModelGateway = {
    provider: "test",
    model: "test",
    async createTurn(req, { onTextDelta }) {
      requests.push(structuredClone(req));
      const next = responses.shift();
      if (!next) throw new Error("script exhausted");
      if (next instanceof Error) throw next;
      for (const b of next.content) if (b.type === "text") onTextDelta(b.text);
      return next;
    },
  };
  return { gateway, requests };
}

const add = defineTool({
  name: "add",
  label: "Adding",
  description: "Adds two numbers",
  input: z.object({ a: z.number(), b: z.number() }),
  run: async ({ a, b }) => ({ sum: a + b }),
});

async function run(
  gateway: ModelGateway,
  tools: AgentTool<unknown>[] = [add as AgentTool<unknown>],
  extra = {},
) {
  const events: AgentEvent[] = [];
  const steps: AgentStep[] = [];
  const outcome = await runAgent({
    gateway,
    system: [{ type: "text", text: "sys" }],
    tools,
    history: [{ role: "user", content: "hi" }],
    signal: new AbortController().signal,
    onEvent: (e) => events.push(e),
    onStep: async (s) => {
      steps.push(s);
    },
    ...extra,
  });
  return { outcome, events, steps };
}

describe("runAgent", () => {
  it("streams a plain answer and stores one step", async () => {
    const { gateway } = scripted(msg([text("Hello!")], "end_turn"));
    const { outcome, events, steps } = await run(gateway);
    expect(outcome).toEqual({ status: "completed" });
    expect(events).toEqual([{ type: "text", delta: "Hello!" }]);
    expect(steps).toHaveLength(1);
    expect(steps[0]!.messages).toEqual([{ role: "assistant", content: [text("Hello!")] }]);
  });

  it("runs parallel tool calls and returns all results in one user message", async () => {
    const { gateway, requests } = scripted(
      msg([toolUse("t1", "add", { a: 1, b: 2 }), toolUse("t2", "add", { a: 3, b: 4 })], "tool_use"),
      msg([text("3 and 7")], "end_turn"),
    );
    const { outcome, steps, events } = await run(gateway);
    expect(outcome.status).toBe("completed");
    expect(steps).toHaveLength(2);
    const [assistant, results] = steps[0]!.messages;
    expect(assistant!.role).toBe("assistant");
    expect(results).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: '{"sum":3}' },
        { type: "tool_result", tool_use_id: "t2", content: '{"sum":7}' },
      ],
    });
    expect(steps[0]!.actions).toEqual(["Adding", "Adding"]);
    expect(
      events.filter((e) => e.type === "tool").map((e) => (e as { status: string }).status),
    ).toEqual(["running", "running", "done", "done"]);
    // The second request carries the full, append-only transcript.
    expect(requests[1]!.messages).toHaveLength(3);
  });

  it("returns invalid input and unknown tools to the model as errors instead of running them", async () => {
    const runSpy = vi.fn(add.run);
    const spied = { ...add, run: runSpy } as AgentTool<unknown>;
    const { gateway } = scripted(
      msg([toolUse("t1", "add", { a: "x" }), toolUse("t2", "nope", {})], "tool_use"),
      msg([text("sorry")], "end_turn"),
    );
    const { steps } = await run(gateway, [spied]);
    expect(runSpy).not.toHaveBeenCalled();
    const results = steps[0]!.messages[1]!.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results.map((r) => r.is_error)).toEqual([true, true]);
    expect(String(results[0]!.content)).toMatch(/Invalid input/);
    expect(String(results[1]!.content)).toMatch(/Unknown tool/);
    expect(steps[0]!.actions).toEqual([]);
  });

  it("hides internal tool errors but passes expected (status) errors through", async () => {
    const boom = defineTool({
      ...add,
      name: "boom",
      run: async () => Promise.reject(new Error("db password leaked")),
    });
    const expected = defineTool({
      ...add,
      name: "expected",
      run: async () =>
        Promise.reject(Object.assign(new Error("Finish onboarding first"), { status: 404 })),
    });
    const { gateway } = scripted(
      msg(
        [toolUse("t1", "boom", { a: 1, b: 1 }), toolUse("t2", "expected", { a: 1, b: 1 })],
        "tool_use",
      ),
      msg([text("ok")], "end_turn"),
    );
    const { steps } = await run(gateway, [boom, expected] as AgentTool<unknown>[]);
    const results = steps[0]!.messages[1]!.content as Anthropic.Beta.BetaToolResultBlockParam[];
    expect(results[0]!.content).not.toMatch(/password/);
    expect(results[1]!.content).toBe("Finish onboarding first");
  });

  it("does not store or run anything on a refusal", async () => {
    const { gateway } = scripted(msg([toolUse("t1", "add", { a: 1, b: 2 })], "refusal"));
    const { outcome, steps } = await run(gateway);
    expect(outcome).toEqual({ status: "refused" });
    expect(steps).toHaveLength(0);
  });

  it("never runs a tool call cut off by max_tokens", async () => {
    const runSpy = vi.fn(add.run);
    const { gateway } = scripted(msg([toolUse("t1", "add", { a: 1, b: 2 })], "max_tokens"));
    const { outcome, steps } = await run(gateway, [{ ...add, run: runSpy } as AgentTool<unknown>]);
    expect(outcome).toEqual({ status: "failed", reason: "max_tokens" });
    expect(runSpy).not.toHaveBeenCalled();
    expect(steps).toHaveLength(0);
  });

  it("continues after pause_turn with the paused turn appended", async () => {
    const { gateway, requests } = scripted(
      msg([text("partial")], "pause_turn"),
      msg([text(" done")], "end_turn"),
    );
    const { outcome, steps } = await run(gateway);
    expect(outcome.status).toBe("completed");
    expect(steps).toHaveLength(2);
    expect(requests[1]!.messages.at(-1)).toEqual({ role: "assistant", content: [text("partial")] });
  });

  it("forces a text answer on the last allowed iteration", async () => {
    const loop = msg([toolUse("t1", "add", { a: 1, b: 1 })], "tool_use");
    const { gateway, requests } = scripted(loop, loop, msg([text("final")], "end_turn"));
    const { outcome } = await run(gateway, undefined, { maxIterations: 3 });
    expect(outcome.status).toBe("completed");
    expect(requests.map((r) => r.toolChoice)).toEqual(["auto", "auto", "none"]);
  });

  it("re-issues a turn whose streamed tool JSON could not be parsed, then gives up", async () => {
    const ok = scripted(new SyntaxError("bad json"), msg([text("fine")], "end_turn"));
    expect((await run(ok.gateway)).outcome.status).toBe("completed");
    const bad = scripted(new SyntaxError("1"), new SyntaxError("2"), new SyntaxError("3"));
    expect((await run(bad.gateway)).outcome).toEqual({
      status: "failed",
      reason: "invalid_tool_json",
    });
  });

  it("stops before calling the model when the client has gone", async () => {
    const { gateway, requests } = scripted(msg([text("x")], "end_turn"));
    const abort = new AbortController();
    abort.abort();
    const { outcome } = await run(gateway, undefined, { signal: abort.signal });
    expect(outcome).toEqual({ status: "aborted" });
    expect(requests).toHaveLength(0);
  });
});

describe("tool helpers", () => {
  it("renders stable JSON schemas without $schema and with eager input streaming", () => {
    const [api] = toApiTools([add as AgentTool<unknown>]);
    expect(api).toMatchObject({ name: "add", eager_input_streaming: true });
    expect(api!.input_schema).toMatchObject({ type: "object", required: ["a", "b"] });
    expect(api!.input_schema).not.toHaveProperty("$schema");
    expect(JSON.stringify(toApiTools([add as AgentTool<unknown>]))).toBe(JSON.stringify([api]));
  });

  it("caps tool output size", () => {
    expect(serializeToolResult({ a: "x".repeat(50) }, 20)).toMatch(/…\(truncated\)$/);
    expect(serializeToolResult({ d: new Date("2026-01-01T00:00:00Z") })).toBe(
      '{"d":"2026-01-01T00:00:00.000Z"}',
    );
  });
});
