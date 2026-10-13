import { Controller, Delete, Get, HttpCode, Param, Post } from "@nestjs/common";
import { WaterAddSchema, type WaterAddInput, type WaterDayDto } from "@fitr8/contracts";
import { UserId } from "../../common/auth/decorators.js";
import { ZodBody } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { UsersService } from "../users/users.service.js";
import { WaterService } from "./water.service.js";

/** Thin HTTP adapter: auth + validation here, rules in WaterService. */
@Controller("water")
export class WaterController {
  constructor(
    private readonly water: WaterService,
    private readonly users: UsersService,
  ) {}

  /** Today's water target (with its reason), amount drunk and the entries (for undo). */
  @Get()
  async today(@UserId() userId: string): Promise<WaterDayDto> {
    return wire(this.water.getDay(userId, await this.users.today(userId)));
  }

  /** Log a glass or bottle; returns the updated day. */
  @Post()
  async add(
    @UserId() userId: string,
    @ZodBody(WaterAddSchema) { ml }: WaterAddInput,
  ): Promise<WaterDayDto> {
    const date = await this.users.today(userId);
    await this.water.add(userId, date, ml);
    return wire(this.water.getDay(userId, date));
  }

  /** Undo one water entry. */
  @Delete(":id")
  @HttpCode(204)
  async remove(@UserId() userId: string, @Param("id") id: string) {
    await this.water.remove(userId, id);
  }
}
