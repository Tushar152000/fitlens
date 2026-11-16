import { Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import {
  ReminderParseSchema,
  ReminderSchema,
  ReminderUpdateSchema,
  type ReminderDraftDto,
  type ReminderDto,
  type ReminderInput,
  type ReminderListDto,
  type ReminderParseInput,
  type ReminderUpdateInput,
} from "@fitr8/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { wire } from "../../common/http/wire.js";
import { ZodBody } from "../../common/http/zod.js";
import { RemindersService } from "./reminders.service.js";

/** Thin HTTP adapter: auth + validation here, rules in RemindersService. */
@Controller("reminders")
export class RemindersController {
  constructor(private readonly reminders: RemindersService) {}

  @Get()
  list(@UserId() userId: string): Promise<ReminderListDto> {
    return wire(this.reminders.list(userId));
  }

  /** "Remind me to take creatine every day at 9 am" → a draft to review. Nothing is saved. */
  @Post("parse")
  @HttpCode(200)
  parse(
    @UserId() userId: string,
    @ZodBody(ReminderParseSchema) { text }: ReminderParseInput,
  ): Promise<ReminderDraftDto> {
    return this.reminders.parse(userId, text);
  }

  @Post()
  create(
    @UserId() userId: string,
    @ZodBody(ReminderSchema) input: ReminderInput,
  ): Promise<ReminderDto> {
    return wire(this.reminders.create(userId, input));
  }

  @Patch(":id")
  update(
    @UserId() userId: string,
    @Param("id") id: string,
    @ZodBody(ReminderUpdateSchema) input: ReminderUpdateInput,
  ): Promise<ReminderDto> {
    return wire(this.reminders.update(userId, id, input));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param("id") id: string) {
    await this.reminders.remove(userId, id);
  }
}
