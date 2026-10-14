import { Global, Module } from "@nestjs/common";
import { ENV, type Env } from "../../config/config.module.js";
import { BillingController } from "./billing.controller.js";
import { BillingService } from "./billing.service.js";
import { REVENUECAT, RevenueCatClient } from "./revenuecat.js";

/**
 * FITR8 Pro (docs/PREMIUM.md). Owns entitlements and billing_events. Global: quotas in meals,
 * coach and foods, and /api/me, read the plan through BillingService.
 */
@Global()
@Module({
  controllers: [BillingController],
  providers: [
    BillingService,
    {
      provide: REVENUECAT,
      inject: [ENV],
      useFactory: (env: Env) =>
        new RevenueCatClient({
          secretKey: env.REVENUECAT_SECRET_KEY,
          entitlement: env.REVENUECAT_ENTITLEMENT,
        }),
    },
  ],
  exports: [BillingService],
})
export class BillingModule {}
