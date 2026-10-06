import type { CoachStreamEvent } from "@fitr8/contracts";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, onboardingPayload, type TestApp } from "./support/app.js";

/** Parse a buffered text/event-stream body into its JSON events (heartbeat comments are skipped). */
function events(body: string): CoachStreamEvent[] {
  return body
    .split("\n\n")
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.startsWith("data: "))
    .map((chunk) => JSON.parse(chunk.slice(6)) as CoachStreamEvent);
}

describe("coach (agent loop, mock model)", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp();
  });
  afterAll(() => t.close());

  async function onboardedUser() {
    const user = await t.signIn("Coach Tester");
    await user.agent.post("/api/onboarding").send(onboardingPayload()).expect(201);
    return user;
  }

  const chat = (agent: Awaited<ReturnType<TestApp["signIn"]>>["agent"], body: object) =>
    agent
      .post("/api/coach/chat")
      .send(body)
      .buffer(true)
      .parse((res, cb) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (c: string) => (data += c));
        res.on("end", () => cb(null, data));
      });

  it("requires sign-in and a message", async () => {
    await t.http().post("/api/coach/chat").send({ message: "hi" }).expect(401);
    const { agent } = await t.signIn();
    await agent.post("/api/coach/chat").send({ message: "" }).expect(400);
  });

  it("streams a turn that uses a tool, and persists a clean transcript", async () => {
    const { agent } = await onboardedUser();
    const res = await chat(agent, { message: "How am I doing today?" }).expect(200);
    expect(res.headers["content-type"]).toMatch(/text\/event-stream/);

    const stream = events(res.body as string);
    expect(stream[0]!.type).toBe("conversation");
    const conversationId = (stream[0] as { conversationId: string }).conversationId;
    const tools = stream.filter((e) => e.type === "tool");
    expect(tools.map((e) => (e as { name: string; status: string }).status)).toEqual([
      "running",
      "done",
    ]);
    expect((tools[0] as { name: string }).name).toBe("get_today_overview");
    expect(stream.some((e) => e.type === "text")).toBe(true);
    expect(stream.at(-1)!.type).toBe("done");

    const list = await agent.get("/api/coach/conversations").expect(200);
    expect(list.body[0]).toMatchObject({ id: conversationId, title: "How am I doing today?" });

    const view = await agent.get(`/api/coach/conversations/${conversationId}`).expect(200);
    expect(view.body.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(view.body.messages[1].actions).toEqual(["Checking today's meals"]);

    // Stored transcript: user, assistant(tool_use), user(tool_result), assistant(text) — replayable as-is.
    const rows = await t.prisma.coachMessage.findMany({
      where: { conversationId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    expect(rows.map((r) => r.role)).toEqual(["user", "assistant", "user", "assistant"]);
    const calls = await t.prisma.aiCall.count({
      where: { type: "COACH_CHAT", user: { coachChats: { some: { id: conversationId } } } },
    });
    expect(calls).toBe(2);
  });

  it("continues a conversation and can log water through a tool", async () => {
    const { agent } = await onboardedUser();
    const first = events((await chat(agent, { message: "hello" }).expect(200)).body as string);
    const conversationId = (first[0] as { conversationId: string }).conversationId;

    const second = events(
      (await chat(agent, { conversationId, message: "I drank 500 ml of water" }).expect(200))
        .body as string,
    );
    expect(second.find((e) => e.type === "tool")).toMatchObject({ name: "log_water" });
    expect((await agent.get("/api/water").expect(200)).body.consumedMl).toBe(500);

    const view = await agent.get(`/api/coach/conversations/${conversationId}`).expect(200);
    expect(view.body.messages).toHaveLength(4);
  });

  it("keeps conversations private", async () => {
    const owner = await onboardedUser();
    const first = events((await chat(owner.agent, { message: "hi" }).expect(200)).body as string);
    const conversationId = (first[0] as { conversationId: string }).conversationId;

    const other = await onboardedUser();
    await other.agent.get(`/api/coach/conversations/${conversationId}`).expect(404);
    await other.agent.post("/api/coach/chat").send({ conversationId, message: "hi" }).expect(404);
    await other.agent.delete(`/api/coach/conversations/${conversationId}`).expect(404);

    await owner.agent.delete(`/api/coach/conversations/${conversationId}`).expect(204);
    await owner.agent.get(`/api/coach/conversations/${conversationId}`).expect(404);
  });

  it("enforces the daily message limit", async () => {
    const { userId, agent } = await onboardedUser();
    const conversation = await t.prisma.coachConversation.create({ data: { userId } });
    await t.prisma.coachMessage.createMany({
      data: Array.from({ length: 40 }, () => ({
        conversationId: conversation.id,
        role: "user",
        content: [],
        text: "x",
      })),
    });
    const res = await agent.post("/api/coach/chat").send({ message: "one more" }).expect(429);
    expect(res.body.error).toMatch(/today's coach limit/);
  });
});
