import { Module } from "@nestjs/common";
import { MealAnalysisJob } from "./meal-analysis.job.js";
import { MealItemsService } from "./meal-items.service.js";
import { MealsController } from "./meals.controller.js";
import { MealsService } from "./meals.service.js";
import { ScanQuotaService } from "./scan-quota.service.js";
import { UsualsService } from "./usuals.service.js";

@Module({
  controllers: [MealsController],
  providers: [MealsService, MealItemsService, ScanQuotaService, UsualsService, MealAnalysisJob],
  exports: [MealsService, MealItemsService, ScanQuotaService, UsualsService],
})
export class MealsModule {}
