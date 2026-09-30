import { Module } from "@nestjs/common";
import { MealsModule } from "../meals/meals.module.js";
import { BarcodeService } from "./barcode.service.js";
import { FoodsController } from "./foods.controller.js";
import { FoodsService } from "./foods.service.js";
import { LabelsService } from "./labels.service.js";

@Module({
  imports: [MealsModule],
  controllers: [FoodsController],
  providers: [FoodsService, BarcodeService, LabelsService],
  exports: [FoodsService, BarcodeService, LabelsService],
})
export class FoodsModule {}
