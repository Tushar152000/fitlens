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

  it("answers clearly off-topic requests without calling the model", async () => {
    const { agent } = await onboardedUser();
    const stream = events(
      (
        await chat(agent, { message: "Write a python program to reverse a linked list" }).expect(
          200,
        )
      ).body as string,
    );
    const conversationId = (stream[0] as { conversationId: string }).conversationId;
    expect(stream.some((e) => e.type === "tool")).toBe(false);
    const text = stream
      .filter((e): e is { type: "text"; delta: string } => e.type === "text")
      .map((e) => e.delta)
      .join("");
    expect(text).toMatch(/fitness, food, training/);
    expect(stream.at(-1)!.type).toBe("done");
    const calls = await t.prisma.aiCall.count({
      where: { type: "COACH_CHAT", user: { coachChats: { some: { id: conversationId } } } },
    });
    expect(calls).toBe(0);
    const view = await agent.get(`/api/coach/conversations/${conversationId}`).expect(200);
    expect(view.body.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
  });

  it("opens a chat with the user's profile, today and memory; later turns carry only today", async () => {
    const { agent } = await onboardedUser();
    const first = events((await chat(agent, { message: "hello" }).expect(200)).body as string);
    const conversationId = (first[0] as { conversationId: string }).conversationId;
    await chat(agent, { conversationId, message: "and now?" }).expect(200);

    const typed = await t.prisma.coachMessage.findMany({
      where: { conversationId, role: "user", text: { not: "" } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const contextOf = (row: (typeof typed)[number]) => (row.content as { text: string }[])[0]!.text;
    expect(contextOf(typed[0]!)).toMatch(/User: Coach Tester, \d+ y, /);
    expect(contextOf(typed[0]!)).toMatch(/Goal: /);
    expect(contextOf(typed[0]!)).toMatch(/Today: target \d+ kcal/);
    expect(contextOf(typed[0]!)).toMatch(/<memory>nothing saved yet<\/memory>/);
    expect(contextOf(typed[1]!)).toMatch(/^<context>\nNow: .*\nToday: /);
    expect(contextOf(typed[1]!)).not.toMatch(/User: /);
  });

  it("remembers facts across chats, and the user can see and delete them", async () => {
    const { agent } = await onboardedUser();
    const stream = events(
      (await chat(agent, { message: "remember I have a left knee injury" }).expect(200))
        .body as string,
    );
    expect(stream.find((e) => e.type === "tool")).toMatchObject({ name: "remember" });

    const list = await agent.get("/api/coach/memories").expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({ id: expect.any(String), text: "I have a left knee injury" }),
    ]);
    const memoryId = list.body[0].id as string;

    // A new chat starts with the memory in its context, with the id the coach needs to forget it.
    const next = events((await chat(agent, { message: "hello" }).expect(200)).body as string);
    const nextId = (next[0] as { conversationId: string }).conversationId;
    const opening = await t.prisma.coachMessage.findFirstOrThrow({
      where: { conversationId: nextId, role: "user" },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
    const context = (opening.content as { text: string }[])[0]!.text;
    expect(context).toContain(`- [${memoryId}] I have a left knee injury`);
    expect(context).toMatch(/Recent chats: "remember I have a left knee injury"/);

    const other = await onboardedUser();
    await other.agent.delete(`/api/coach/memories/${memoryId}`).expect(404);
    expect((await other.agent.get("/api/coach/memories").expect(200)).body).toEqual([]);

    await agent.delete(`/api/coach/memories/${memoryId}`).expect(204);
    expect((await agent.get("/api/coach/memories").expect(200)).body).toEqual([]);
  });

  it("looks up the science notes with their sources", async () => {
    const { agent } = await onboardedUser();
    const stream = events(
      (await chat(agent, { message: "How much protein do I need to build muscle?" }).expect(200))
        .body as string,
    );
    const conversationId = (stream[0] as { conversationId: string }).conversationId;
    expect(stream.find((e) => e.type === "tool")).toMatchObject({ name: "search_knowledge" });
    const results = await t.prisma.coachMessage.findMany({
      where: { conversationId, role: "user", text: "" },
    });
    const output = JSON.stringify(results.map((r) => r.content));
    expect(output).toContain("How much protein to eat");
    expect(output).toContain("ISSN Position Stand: protein and exercise");
  });

  it("finds what was said in earlier chats, and reads the full profile", async () => {
    const { agent } = await onboardedUser();
    await chat(agent, { message: "I drank 500 ml of water" }).expect(200);
    const recall = events(
      (await chat(agent, { message: "what did you say earlier about water?" }).expect(200))
        .body as string,
    );
    const recallId = (recall[0] as { conversationId: string }).conversationId;
    expect(recall.find((e) => e.type === "tool")).toMatchObject({ name: "search_past_chats" });
    const [result] = await t.prisma.coachMessage.findMany({
      where: { conversationId: recallId, role: "user", text: "" },
    });
    expect(JSON.stringify(result!.content)).toContain("I drank 500 ml of water");

    const profile = events(
      (await chat(agent, { message: "tell me about my profile" }).expect(200)).body as string,
    );
    const profileId = (profile[0] as { conversationId: string }).conversationId;
    expect(profile.find((e) => e.type === "tool")).toMatchObject({ name: "get_profile" });
    const [out] = await t.prisma.coachMessage.findMany({
      where: { conversationId: profileId, role: "user", text: "" },
    });
    const json = JSON.stringify(out!.content);
    expect(json).toContain("dietType");
    expect(json).not.toContain("email");
  });

  it("counts only typed messages toward the daily limit", async () => {
    const { userId, agent } = await onboardedUser();
    const conversation = await t.prisma.coachConversation.create({ data: { userId } });
    // 40 tool-result rows (stored as "user" with no display text) are not messages the user sent.
    await t.prisma.coachMessage.createMany({
      data: Array.from({ length: 40 }, () => ({
        conversationId: conversation.id,
        role: "user",
        content: [],
        text: "",
      })),
    });
    await chat(agent, { message: "hello" }).expect(200);
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
