import { Module } from "@nestjs/common";
import { RemindersController } from "./reminders.controller.js";
import { RemindersService } from "./reminders.service.js";

/** Owns `reminders`. Config only: the app schedules them as local notifications. */
@Module({
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
