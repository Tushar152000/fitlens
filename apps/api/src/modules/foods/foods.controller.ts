import { Controller, Get, Param, Post, Query } from "@nestjs/common";
import {
  LabelSaveSchema,
  LabelScanSchema,
  type BarcodeProductDto,
  type CreatedDto,
  type FoodSearchDto,
  type LabelSaveInput,
  type LabelScanDto,
  type LabelScanInput,
} from "@fitlens/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { ZodBody } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { BarcodeService } from "./barcode.service.js";
import { FoodsService } from "./foods.service.js";
import { LabelsService } from "./labels.service.js";

/** Thin HTTP adapter for the food database, barcodes and label scans. */
@Controller("foods")
export class FoodsController {
  constructor(
    private readonly foods: FoodsService,
    private readonly barcodes: BarcodeService,
    private readonly labels: LabelsService,
  ) {}

  /** Food search for adding a missed item. */
  @Get()
  search(@UserId() userId: string, @Query("q") q?: string): Promise<FoodSearchDto> {
    return this.foods.search(userId, q ?? "");
  }

  /** Look up a packaged food by barcode. Never uses a photo scan. 404 = unknown product. */
  @Get("barcode/:code")
  barcode(@UserId() userId: string, @Param("code") code: string): Promise<BarcodeProductDto> {
    return wire(this.barcodes.product(code, userId));
  }

  /** Read a nutrition-label photo (design 7f). Uses 1 photo scan. Returns the scan id for 7g. */
  @Post("label")
  scanLabel(
    @UserId() userId: string,
    @ZodBody(LabelScanSchema) input: LabelScanInput,
  ): Promise<CreatedDto> {
    return this.labels.scan(userId, input);
  }

  /** Design 7g data: the values read from the label, for the user to check. */
  @Get("label/:id")
  label(@UserId() userId: string, @Param("id") id: string): Promise<LabelScanDto> {
    return this.labels.get(userId, id);
  }

  /** Design 7g "Save and add": creates the food from checked values and logs it. */
  @Post("label/:id/save")
  saveLabel(
    @UserId() userId: string,
    @Param("id") id: string,
    @ZodBody(LabelSaveSchema) input: LabelSaveInput,
  ): Promise<CreatedDto> {
    return this.labels.save(userId, id, input);
  }
}
