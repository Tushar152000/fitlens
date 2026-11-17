import { Controller, Delete, Get, HttpCode, Patch, Post, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  PhoneCheckQuerySchema,
  PreferredNameSchema,
  type PhoneCheckDto,
  type PhoneCheckQuery,
  RemindersSchema,
  type MeDto,
  type PreferredNameInput,
  type RemindersDto,
  type RemindersInput,
} from "@fitr8/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { ZodBody, ZodQuery } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { AuthService } from "../auth/auth.service.js";
import { UsersService } from "./users.service.js";

@Controller()
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly auth: AuthService,
  ) {}

  /** Who is signed in, and whether onboarding is done. The app's first call after sign-in. */
  @Get("me")
  me(@UserId() userId: string): Promise<MeDto> {
    return wire(this.users.me(userId));
  }

  /** "Not now" on the welcome-back check-in: keep the old numbers and stop asking. */
  @Post("me/active")
  @HttpCode(204)
  async active(@UserId() userId: string): Promise<void> {
    await this.users.markActive(userId);
  }

  /** Design 13 "Export CSV": a download of every confirmed meal item and weigh-in. */
  @Get("export")
  async export(@UserId() userId: string, @Res() res: Response) {
    const { filename, csv } = await this.users.exportCsv(userId);
    res
      .status(200)
      .set({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      })
      .send(csv);
  }

  /** Onboarding step 1 (web and app): first name, last name, phone. */
  @Patch("profile/name")
  name(
    @UserId() userId: string,
    @ZodBody(PreferredNameSchema) input: PreferredNameInput,
  ): Promise<MeDto> {
    return wire(this.users.setName(userId, input));
  }

  /** Onboarding step 1: warn before Continue when another account has the number. */
  @Get("profile/phone-check")
  async phoneCheck(
    @UserId() userId: string,
    @ZodQuery(PhoneCheckQuerySchema) { phone }: PhoneCheckQuery,
  ): Promise<PhoneCheckDto> {
    return { phone, available: await this.users.phoneAvailable(userId, phone) };
  }

  /** Save the design-13 reminder switches (lunch, dinner, water). */
  @Patch("profile/reminders")
  reminders(
    @UserId() userId: string,
    @ZodBody(RemindersSchema) input: RemindersInput,
  ): Promise<RemindersDto> {
    return this.users.setReminders(userId, input);
  }

  /** Design 13 "Delete account". */
  @Delete("account")
  @HttpCode(204)
  async deleteAccount(@UserId() userId: string) {
    // Apple requires revoking Sign in with Apple when the account goes (guideline 5.1.1(v)).
    await this.auth.revokeAppleSignIn(userId);
    await this.users.deleteAccount(userId);
  }
}
