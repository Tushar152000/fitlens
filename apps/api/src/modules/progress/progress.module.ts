import { Module } from "@nestjs/common";
import { PlanModule } from "../plan/plan.module.js";
import { CheckinsService } from "./checkins.service.js";
import { DashboardService } from "./dashboard.service.js";
import { HistoryService } from "./history.service.js";
import { ProgressController } from "./progress.controller.js";
import { ProgressService } from "./progress.service.js";

@Module({
  imports: [PlanModule],
  controllers: [ProgressController],
  providers: [CheckinsService, DashboardService, HistoryService, ProgressService],
  exports: [CheckinsService, DashboardService, HistoryService, ProgressService],
})
export class ProgressModule {}
