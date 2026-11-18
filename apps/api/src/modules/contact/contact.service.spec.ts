import { describe, expect, it } from "vitest";
import { AppError } from "../../common/errors.js";
import type { Env } from "../../config/config.module.js";
import type { MailMessage, Mailer } from "../../infra/mail/mailer.js";
import { ContactService } from "./contact.service.js";

const input = { name: "Asha", email: "asha@example.com", message: "Hello there, a question." };

function setup(env: Partial<Env> = {}, enabled = true) {
  const sent: MailMessage[] = [];
  const mailer: Mailer = {
    enabled,
    send: async (m) => {
      sent.push(m);
    },
  };
  const service = new ContactService(
    { APP_ENV: "local", CONTACT_TO: "team@example.com", CONTACT_HOURLY_LIMIT: 2, ...env } as Env,
    mailer,
  );
  return { service, sent };
}

describe("ContactService", () => {
  it.each(["local", "production"] as const)(
    "refuses with 503 without SMTP (%s), pointing at the email address",
    async (APP_ENV) => {
      const { service } = setup({ APP_ENV }, false);
      const err = await service.send(input, "1.1.1.1").catch((e: unknown) => e);
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(503);
      expect((err as AppError).message).toContain("team@example.com");
    },
  );

  it("frees an IP's budget after an hour", async () => {
    const { service, sent } = setup();
    const t0 = 1_000_000;
    await service.send(input, "1.1.1.1", t0);
    await service.send(input, "1.1.1.1", t0 + 1);
    await expect(service.send(input, "1.1.1.1", t0 + 2)).rejects.toMatchObject({ status: 429 });
    // Another IP is unaffected.
    await service.send(input, "2.2.2.2", t0 + 3);
    // An hour after the first two, the first IP can send again.
    await service.send(input, "1.1.1.1", t0 + 60 * 60 * 1000 + 2);
    expect(sent).toHaveLength(4);
  });

  it("does not count honeypot hits against the budget", async () => {
    const { service, sent } = setup({ CONTACT_HOURLY_LIMIT: 1 });
    await service.send({ ...input, website: "x" }, "1.1.1.1");
    await service.send(input, "1.1.1.1");
    expect(sent).toHaveLength(1);
  });
});
