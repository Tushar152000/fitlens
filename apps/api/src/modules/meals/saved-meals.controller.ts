import { Controller, Delete, Get, HttpCode, Param, Post, Put } from "@nestjs/common";
import {
  LogSavedMealSchema,
  SavedMealSchema,
  type CreatedDto,
  type LogSavedMealInput,
  type SavedMealDto,
  type SavedMealInput,
  type SavedMealsDto,
} from "@fitr8/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { wire } from "../../common/http/wire.js";
import { ZodBody } from "../../common/http/zod.js";
import { SavedMealsService } from "./saved-meals.service.js";

/** Thin HTTP adapter for a user's saved (repeat) meals. Static paths come before `:id`. */
@Controller("saved-meals")
export class SavedMealsController {
  constructor(private readonly saved: SavedMealsService) {}

  @Get()
  list(@UserId() userId: string): Promise<SavedMealsDto> {
    return wire(this.saved.list(userId));
  }

  /** Build one from items: the saved-meal builder, or "Save as a meal" on meal review. */
  @Post()
  create(
    @UserId() userId: string,
    @ZodBody(SavedMealSchema) input: SavedMealInput,
  ): Promise<SavedMealDto> {
    return wire(this.saved.create(userId, input));
  }

  @Put(":id")
  update(
    @UserId() userId: string,
    @Param("id") id: string,
    @ZodBody(SavedMealSchema) input: SavedMealInput,
  ): Promise<SavedMealDto> {
    return wire(this.saved.update(userId, id, input));
  }

  @Delete(":id")
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param("id") id: string) {
    await this.saved.remove(userId, id);
  }

  /** One tap: log it to a meal slot, today or a recent `date`. No AI, no scan used. */
  @Post(":id/log")
  log(
    @UserId() userId: string,
    @Param("id") id: string,
    @ZodBody(LogSavedMealSchema) input: LogSavedMealInput,
  ): Promise<CreatedDto> {
    return this.saved.log(userId, id, input);
  }
}
