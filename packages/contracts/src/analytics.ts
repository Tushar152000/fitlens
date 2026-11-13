/**
 * Product analytics events, sent to Google Analytics 4 by the web (gtag, after cookie consent) and
 * the app (Firebase Analytics). Same names and params on every client so reports line up.
 *
 * Privacy rule: params are coarse labels only. Never send health values (weight, kcal, body fat,
 * goal targets), names, emails, photos or free text. The user id sent to Analytics is FITR8's
 * internal id, never an email. Setup and data notes: docs/ANALYTICS.md.
 */
export type MealLogMethod = "photo" | "type" | "barcode" | "label" | "usual";

export interface AnalyticsEvents {
  /** Signed in (any provider). New accounts also send `onboarding_complete` once. */
  login: { method: "google" | "apple" | "dev" };
  /** Finished onboarding and got a plan; the sign-up conversion. */
  onboarding_complete: { platform: "web" | "app" };
  /** A meal was saved to the day. */
  meal_logged: { method: MealLogMethod };
  /** A message was sent to the AI coach. */
  coach_message: Record<string, never>;
  /** FITR8 Pro bought in the app store (trial starts count). */
  pro_purchase: { period: "month" | "year" };
  /** Landing page calorie calculator submitted (web). */
  calculator_used: Record<string, never>;
  /** "Get the app" store badge tapped (web). */
  store_click: { store: "app_store" | "play_store" };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
