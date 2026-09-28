import { Module } from "@nestjs/common";
import { MealsModule } from "../meals/meals.module.js";
import { PlanModule } from "../plan/plan.module.js";
import { WorkoutsController } from "./workouts.controller.js";
import { WorkoutsService } from "./workouts.service.js";

@Module({
  imports: [PlanModule, MealsModule],
  controllers: [WorkoutsController],
  providers: [WorkoutsService],
  exports: [WorkoutsService],
})
export class WorkoutsModule {}
