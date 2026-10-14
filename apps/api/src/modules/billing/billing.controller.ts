import { Body, Controller, Get, Headers, HttpCode, Post } from "@nestjs/common";
import type { BillingDto } from "@fitr8/contracts";
import { Public, UserId } from "../../common/auth/decorators.js";
import { BillingService } from "./billing.service.js";

/** Thin HTTP adapter for FITR8 Pro. */
@Controller("billing")
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  /** The caller's plan, renewal and today's limits. */
  @Get()
  get(@UserId() userId: string): Promise<BillingDto> {
    return this.billing.billing(userId);
  }

  /** The app calls this right after a purchase or "Restore purchases". */
  @Post("refresh")
  @HttpCode(200)
  refresh(@UserId() userId: string): Promise<BillingDto> {
    return this.billing.refresh(userId);
  }

  /**
   * RevenueCat → us. Public (no session), authenticated by the shared Authorization header,
   * checked before the body is parsed. Always 200 once handled, so RevenueCat stops retrying.
   */
  @Public()
  @Post("revenuecat")
  @HttpCode(200)
  webhook(@Headers("authorization") authorization: string | undefined, @Body() body: unknown) {
    return this.billing.handleWebhook(authorization, body);
  }
}
