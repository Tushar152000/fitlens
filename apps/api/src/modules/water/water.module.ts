import { Module } from "@nestjs/common";
import { WorkoutsModule } from "../workouts/workouts.module.js";
import { WaterController } from "./water.controller.js";
import { WaterService } from "./water.service.js";

@Module({
  imports: [WorkoutsModule],
  controllers: [WaterController],
  providers: [WaterService],
  exports: [WaterService],
})
export class WaterModule {}
