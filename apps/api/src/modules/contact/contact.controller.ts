import { Controller, HttpCode, Post, Req } from "@nestjs/common";
import { ContactMessageSchema, type ContactMessageInput } from "@fitr8/contracts";
import type { Request } from "express";
import { Public } from "../../common/auth/decorators.js";
import { StrictRateLimit } from "../../common/http/rate-limit.js";
import { ZodBody } from "../../common/http/zod.js";
import { ContactService } from "./contact.service.js";

/** The website's "Contact us" form. Public: visitors aren't signed in. */
@Controller("contact")
export class ContactController {
  constructor(private readonly contact: ContactService) {}

  /** Emails the message to the team. `{ sent: true }`, or an error with a message to show. */
  @Public()
  @StrictRateLimit()
  @Post()
  @HttpCode(200)
  async send(
    @ZodBody(ContactMessageSchema) body: ContactMessageInput,
    @Req() req: Request,
  ): Promise<{ sent: true }> {
    await this.contact.send(body, req.ip ?? req.socket.remoteAddress ?? "unknown");
    return { sent: true };
  }
}
