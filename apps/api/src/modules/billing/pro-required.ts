import type { PremiumFeature, ProRequiredDetails } from "@fitr8/contracts";
import { AppError } from "../../common/errors.js";

/**
 * 402 for a Premium feature the caller's plan doesn't include. Every client reacts the same way:
 * open the Premium screen for `feature` (docs/PREMIUM.md).
 */
export function proRequired(feature: PremiumFeature, message: string): AppError {
  const details: ProRequiredDetails = { reason: "pro_required", feature };
  return new AppError(402, message, details);
}
