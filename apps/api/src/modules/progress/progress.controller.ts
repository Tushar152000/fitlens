import { Controller, Get, Post, Query } from "@nestjs/common";
import {
  CheckinSchema,
  type CheckinDto,
  type CheckinInput,
  type CheckinsDto,
  type DashboardDto,
  type HistoryDto,
  type ProgressDto,
} from "@fitlens/contracts";
import { parseDateOnly } from "@fitlens/domain/dates";
import { UserId } from "../../common/auth/decorators.js";
import { ZodBody } from "../../common/http/zod.js";
import { wire } from "../../common/http/wire.js";
import { UsersService } from "../users/users.service.js";
import { CheckinsService } from "./checkins.service.js";
import { DashboardService } from "./dashboard.service.js";
import { HistoryService } from "./history.service.js";
import { ProgressService } from "./progress.service.js";

/** Thin HTTP adapter for weigh-ins, the Today dashboard, history and progress. */
@Controller()
export class ProgressController {
  constructor(
    private readonly checkins: CheckinsService,
    private readonly dashboard: DashboardService,
    private readonly history: HistoryService,
    private readonly progress: ProgressService,
    private readonly users: UsersService,
  ) {}

  /** Log a weigh-in (replaces that day's). */
  @Post("checkins")
  logWeighIn(
    @UserId() userId: string,
    @ZodBody(CheckinSchema) input: CheckinInput,
  ): Promise<CheckinDto> {
    return wire(this.checkins.logWeighIn(userId, input));
  }

  @Get("checkins")
  listCheckins(@UserId() userId: string): Promise<CheckinsDto> {
    return wire(this.checkins.list(userId));
  }

  /** Screen 6 data: the day's targets and meals, plus the logging streak. `?date=YYYY-MM-DD`, default today. */
  @Get("dashboard")
  async getDashboard(
    @UserId() userId: string,
    @Query("date") date?: string,
  ): Promise<DashboardDto> {
    return wire(
      this.dashboard.getDay(userId, date ? parseDateOnly(date) : await this.users.today(userId)),
    );
  }

  /** GET /api/history?days=7|30 — daily totals, targets and confirmed meals (design 12). */
  @Get("history")
  async getHistory(@UserId() userId: string, @Query("days") days?: string): Promise<HistoryDto> {
    return this.history.getHistory(userId, days === "30" ? 30 : 7, await this.users.today(userId));
  }

  /** Screen 11 data: weigh-in trend vs plan, and the last 7 days' stats. */
  @Get("progress")
  getProgress(@UserId() userId: string): Promise<ProgressDto> {
    return wire(this.progress.get(userId));
  }
}
