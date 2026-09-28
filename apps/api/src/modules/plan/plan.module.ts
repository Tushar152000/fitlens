import { Module } from "@nestjs/common";
import { PlanController } from "./plan.controller.js";
import { PlanService } from "./plan.service.js";
import { TargetsService } from "./targets.service.js";

@Module({
  controllers: [PlanController],
  providers: [PlanService, TargetsService],
  exports: [TargetsService],
})
export class PlanModule {}
