import { describe, expect, it } from "vitest";
import { applyEvent, fromView, parseSse, type ChatMessage } from "./stream";

describe("parseSse", () => {
  it("parses complete events and keeps the unfinished tail", () => {
    const { events, rest } = parseSse(
      'data: {"type":"text","delta":"Hi"}\n\ndata: {"type":"done","messageId":"m1"}\n\ndata: {"ty',
    );
    expect(events).toEqual([
      { type: "text", delta: "Hi" },
      { type: "done", messageId: "m1" },
    ]);
    expect(rest).toBe('data: {"ty');
  });

  it("handles CRLF, comments and bad JSON", () => {
    const { events, rest } = parseSse(
      ': ping\r\n\r\ndata: nope\r\n\r\ndata: {"type":"text","delta":"a"}\r\n\r\n',
    );
    expect(events).toEqual([{ type: "text", delta: "a" }]);
    expect(rest).toBe("");
  });

  it("joins multi-line data fields", () => {
    const { events } = parseSse('data: {"type":"text",\ndata: "delta":"x"}\n\n');
    expect(events).toEqual([{ type: "text", delta: "x" }]);
  });
});

describe("applyEvent", () => {
  const start: ChatMessage[] = [
    { id: "u", role: "user", text: "Dinner?", tools: [] },
    { id: "a", role: "assistant", text: "", tools: [], streaming: true },
  ];

  it("appends text, upserts tool chips and finishes", () => {
    let m = applyEvent(start, {
      type: "tool",
      id: "t1",
      name: "meals",
      label: "Checking today's meals",
      status: "running",
    });
    m = applyEvent(m, { type: "text", delta: "You have " });
    m = applyEvent(m, {
      type: "tool",
      id: "t1",
      name: "meals",
      label: "Checked today's meals",
      status: "done",
    });
    m = applyEvent(m, { type: "text", delta: "900 kcal left." });
    m = applyEvent(m, { type: "done", messageId: "m9" });
    expect(m[1]).toEqual({
      id: "m9",
      role: "assistant",
      text: "You have 900 kcal left.",
      tools: [{ id: "t1", label: "Checked today's meals", status: "done" }],
      streaming: false,
    });
    expect(m[0]).toBe(start[0]);
  });

  it("marks the reply failed on an error event, keeping partial text", () => {
    const m = applyEvent(applyEvent(start, { type: "text", delta: "So" }), {
      type: "error",
      message: "Something went wrong",
    });
    expect(m[1]).toMatchObject({ text: "So", streaming: false, failed: "Something went wrong" });
  });

  it("ignores events when the last message isn't the assistant's", () => {
    const only = [start[0]];
    expect(applyEvent(only, { type: "text", delta: "x" })).toBe(only);
  });
});

describe("fromView", () => {
  it("turns stored actions into done chips", () => {
    expect(
      fromView({
        id: "m",
        role: "assistant",
        text: "Hi",
        actions: ["Checked your plan"],
        createdAt: "",
      }).tools,
    ).toEqual([{ id: "m-0", label: "Checked your plan", status: "done" }]);
  });
});
