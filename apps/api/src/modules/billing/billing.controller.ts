import { Body, Controller, Delete, Get, Headers, HttpCode, Post } from "@nestjs/common";
import { TestPurchaseSchema, type BillingDto, type TestPurchaseInput } from "@fitr8/contracts";
import { Public, UserId } from "../../common/auth/decorators.js";
import { ZodBody } from "../../common/http/zod.js";
import { BillingService } from "./billing.service.js";

/** Thin HTTP adapter for FITR8 Premium. */
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

  /** One-tap Premium, no money, while store billing isn't connected (404 after). */
  @Post("test-purchase")
  @HttpCode(200)
  testPurchase(
    @UserId() userId: string,
    @ZodBody(TestPurchaseSchema) input: TestPurchaseInput,
  ): Promise<BillingDto> {
    return this.billing.testPurchase(userId, input);
  }

  /** End a test purchase: back to Free (for trying the free plan again). */
  @Delete("test-purchase")
  @HttpCode(200)
  endTestPurchase(@UserId() userId: string): Promise<BillingDto> {
    return this.billing.endTestPurchase(userId);
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
