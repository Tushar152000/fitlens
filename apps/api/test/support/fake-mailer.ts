import type { MailMessage, Mailer } from "../../src/infra/mail/mailer.js";

/** Records what would have been emailed. Flip `enabled` or `fail` to test the other paths. */
export class FakeMailer implements Mailer {
  enabled = true;
  fail = false;
  readonly sent: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    if (this.fail) throw new Error("SMTP down");
    this.sent.push(message);
  }
}
