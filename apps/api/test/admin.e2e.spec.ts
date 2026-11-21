import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./support/app.js";

/** The FITR8 admin itself: staff access, ADMIN_EMAILS, invites and roles (sections have their own suites). */
describe("admin", () => {
  let t: TestApp;
  const fixedEmail = `fixed-admin-${randomUUID()}@test.fitlens`;

  beforeAll(async () => {
    t = await createTestApp({ env: { ADMIN_EMAILS: ` ${fixedEmail}, other@test.fitlens ` } });
  });
  afterAll(() => t.close());

  async function as(email: string, name = "Staff Person") {
    const agent = t.browser();
    await agent.post("/api/auth/dev").send({ email, name }).expect(200);
    return agent;
  }

  it("requires sign-in, then staff membership", async () => {
    await t.http().get("/api/admin/me").expect(401);
    await t.http().get("/api/admin/staff").expect(401);
    const { agent } = await t.signIn();
    const res = await agent.get("/api/admin/me").expect(403);
    expect(res.body.error).toBe(
      "This account isn't on the FITR8 team. Ask an admin to invite you.",
    );
    await agent.get("/api/admin/staff").expect(403);
    // Every section sits behind the same guard.
    await agent.get("/api/admin/blog/stats").expect(403);
  });

  it("keeps an ADMIN_EMAILS account an admin that the UI can't demote or remove", async () => {
    const admin = await as(fixedEmail, "Fixed Admin");
    const me = await admin.get("/api/admin/me").expect(200);
    expect(me.body.staff).toMatchObject({ role: "ADMIN", fixed: true, email: fixedEmail });

    const second = await admin
      .post("/api/admin/staff")
      .send({ email: `second-${randomUUID()}@test.fitlens`, role: "ADMIN" })
      .expect(201);
    expect(second.body).toMatchObject({ role: "ADMIN", joined: false, fixed: false });

    await admin.patch(`/api/admin/staff/${me.body.staff.id}`).send({ role: "EDITOR" }).expect(409);
    await admin.delete(`/api/admin/staff/${me.body.staff.id}`).expect(409);
    await admin.delete(`/api/admin/staff/${second.body.id}`).expect(204);
  });

  it("invites, lists, changes roles and enforces who may manage the team", async () => {
    const admin = await as(fixedEmail);
    const email = `editor-${randomUUID()}@test.fitlens`;

    await admin
      .post("/api/admin/staff")
      .send({ email: "not-an-email", role: "EDITOR" })
      .expect(400);
    await admin.post("/api/admin/staff").send({ email, role: "OWNER" }).expect(400);
    const invited = await admin
      .post("/api/admin/staff")
      .send({ email, role: "EDITOR", name: "Meera" })
      .expect(201);
    await admin
      .post("/api/admin/staff")
      .send({ email: email.toUpperCase(), role: "AUTHOR" })
      .expect(409);

    const list = await admin.get("/api/admin/staff").expect(200);
    expect(list.body.some((s: { id: string }) => s.id === invited.body.id)).toBe(true);

    // Claimed on first sign-in; editors run content but not the team.
    const editor = await as(email);
    const me = await editor.get("/api/admin/me").expect(200);
    expect(me.body).toMatchObject({
      staff: { id: invited.body.id, role: "EDITOR", joined: true, fixed: false },
      can: { manageTeam: false },
      sections: { blog: { publish: true, manageContent: true, assignAuthor: true } },
    });
    await editor.get("/api/admin/staff").expect(200);
    await editor
      .post("/api/admin/staff")
      .send({ email: "x@example.com", role: "AUTHOR" })
      .expect(403);
    await editor.patch(`/api/admin/staff/${invited.body.id}`).send({ role: "ADMIN" }).expect(403);

    await admin.patch(`/api/admin/staff/${invited.body.id}`).send({ role: "AUTHOR" }).expect(200);
    const after = await editor.get("/api/admin/me").expect(200);
    expect(after.body.sections.blog).toEqual({
      publish: false,
      manageContent: false,
      assignAuthor: false,
    });

    await admin.patch("/api/admin/staff/missing").send({ role: "AUTHOR" }).expect(404);
    await admin.delete("/api/admin/staff/missing").expect(404);
    await admin.delete(`/api/admin/staff/${invited.body.id}`).expect(204);
    await editor.get("/api/admin/me").expect(403);
  });
});
