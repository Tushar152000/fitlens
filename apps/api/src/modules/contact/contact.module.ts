import { Module } from "@nestjs/common";
import { ContactController } from "./contact.controller.js";
import { ContactService } from "./contact.service.js";

/** Website contact form → email (no tables). Mail goes through the MAILER port (infra/mail). */
@Module({ controllers: [ContactController], providers: [ContactService] })
export class ContactModule {}
