import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createTestApp, type TestApp } from "./support/app.js";

const message = {
  name: "Asha Verma",
  email: "asha@example.com",
  message: "How do I change my goal after onboarding?",
};

describe("contact form", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ env: { CONTACT_HOURLY_LIMIT: "1000" } });
  });
  afterAll(() => t.close());
  beforeEach(() => {
    t.mail.enabled = true;
    t.mail.fail = false;
    t.mail.sent.length = 0;
  });

  it("emails the message to the team without a session, replying to the sender", async () => {
    await t.http().post("/api/contact").send(message).expect(200, { sent: true });

    expect(t.mail.sent).toEqual([
      {
        to: "askfitr8@gmail.com",
        subject: "FITR8 website: message from Asha Verma",
        text: expect.stringContaining("How do I change my goal after onboarding?"),
        replyTo: { name: "Asha Verma", address: "asha@example.com" },
      },
    ]);
    expect(t.mail.sent[0]!.text).toContain("Asha Verma <asha@example.com>");
  });

  it("rejects a missing name, a bad email and a too-short message", async () => {
    const res = await t
      .http()
      .post("/api/contact")
      .send({ name: "", email: "asha@", message: "hi" })
      .expect(400);
    expect(res.body.error).toBeTruthy();
    expect(t.mail.sent).toHaveLength(0);
  });

  it("rejects a name with a line break (it goes into the subject and Reply-To)", async () => {
    await t
      .http()
      .post("/api/contact")
      .send({ ...message, name: "Asha\r\nBcc: someone@example.com" })
      .expect(400);
    expect(t.mail.sent).toHaveLength(0);
  });

  it("quietly drops messages that fill the hidden honeypot field", async () => {
    await t
      .http()
      .post("/api/contact")
      .send({ ...message, website: "https://spam.example" })
      .expect(200, { sent: true });
    expect(t.mail.sent).toHaveLength(0);
  });

  it("says so when the email can't be sent", async () => {
    t.mail.fail = true;
    const res = await t.http().post("/api/contact").send(message).expect(502);
    expect(res.body.error).toContain("askfitr8@gmail.com");
  });

  it("says the form is unavailable when SMTP isn't set up (never a false 'sent')", async () => {
    t.mail.enabled = false;
    const res = await t.http().post("/api/contact").send(message).expect(503);
    expect(res.body.error).toContain("askfitr8@gmail.com");
    expect(t.mail.sent).toHaveLength(0);
  });
});

describe("contact form limits", () => {
  let t: TestApp;
  beforeAll(async () => {
    t = await createTestApp({ env: { CONTACT_HOURLY_LIMIT: "2" } });
  });
  afterAll(() => t.close());

  it("caps messages per IP per hour", async () => {
    await t.http().post("/api/contact").send(message).expect(200);
    await t.http().post("/api/contact").send(message).expect(200);
    const res = await t.http().post("/api/contact").send(message).expect(429);
    expect(res.body.error).toContain("try again later");
    expect(t.mail.sent).toHaveLength(2);
  });
});
