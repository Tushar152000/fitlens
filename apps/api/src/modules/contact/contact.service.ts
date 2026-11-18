import { Injectable, Logger } from "@nestjs/common";
import type { ContactMessageInput } from "@fitr8/contracts";
import { AppError } from "../../common/errors.js";
import { InjectEnv, type Env } from "../../config/config.module.js";
import { InjectMailer, type Mailer } from "../../infra/mail/mailer.js";

const HOUR_MS = 60 * 60 * 1000;

/**
 * The website's contact form: emails each message to CONTACT_TO with Reply-To set to the sender.
 * Stores nothing. Abuse limits: a honeypot field, CONTACT_HOURLY_LIMIT per IP (in memory, per
 * process, like the global throttler), and the strict per-minute rate limit on the route.
 */
@Injectable()
export class ContactService {
  private readonly logger = new Logger(ContactService.name);
  /** Send times per client IP within the last hour. */
  private readonly recent = new Map<string, number[]>();

  constructor(
    @InjectEnv() private readonly env: Env,
    @InjectMailer() private readonly mailer: Mailer,
  ) {}

  async send(input: ContactMessageInput, ip: string, now = Date.now()): Promise<void> {
    // Bots fill every field; people never see this one. Look successful, send nothing.
    if (input.website) return;

    this.claimSlot(ip, now);

    // Never report "sent" for a message that wasn't: without SMTP the visitor is told to email us.
    if (!this.mailer.enabled) {
      this.logger.warn("contact message not sent: SMTP_HOST/SMTP_USER/SMTP_PASS are not set");
      throw new AppError(
        503,
        `Our contact form isn’t available right now. Please email us at ${this.env.CONTACT_TO}.`,
      );
    }

    try {
      await this.mailer.send({
        to: this.env.CONTACT_TO,
        subject: `FITR8 website: message from ${input.name}`,
        text: `${input.message}\n\n— ${input.name} <${input.email}>\nSent from the contact form on the FITR8 website.`,
        replyTo: { name: input.name, address: input.email },
      });
    } catch (err) {
      this.logger.error({ err }, "contact message failed to send");
      throw new AppError(
        502,
        `We couldn’t send your message. Please try again, or email us at ${this.env.CONTACT_TO}.`,
      );
    }
  }

  /** Counts this send against the IP's hourly budget, or throws 429 when it's used up. */
  private claimSlot(ip: string, now: number) {
    const since = now - HOUR_MS;
    const times = (this.recent.get(ip) ?? []).filter((t) => t > since);
    if (times.length >= this.env.CONTACT_HOURLY_LIMIT) {
      this.recent.set(ip, times);
      throw new AppError(
        429,
        `You’ve sent a few messages already. Please try again later, or email us at ${this.env.CONTACT_TO}.`,
      );
    }
    times.push(now);
    this.recent.set(ip, times);
    // Keep the map from growing forever: drop IPs with nothing in the window.
    if (this.recent.size > 10_000) {
      for (const [key, list] of this.recent) {
        if (!list.some((t) => t > since)) this.recent.delete(key);
      }
    }
  }
}
