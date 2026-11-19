/**
 * Product analytics events, sent to Google Analytics 4 by the web (gtag, after cookie consent) and
 * the app (Firebase Analytics). Same names and params on every client so reports line up.
 *
 * Privacy rule: params are coarse labels only. Never send health values (weight, kcal, body fat,
 * goal targets), names, emails, photos or free text. The user id sent to Analytics is FITR8's
 * internal id, never an email. Setup and data notes: docs/ANALYTICS.md.
 */
export type MealLogMethod = "photo" | "type" | "barcode" | "label" | "usual" | "saved";

export interface AnalyticsEvents {
  /** Signed in (any provider). New accounts also send `onboarding_complete` once. */
  login: { method: "google" | "apple" | "dev" };
  /** Finished onboarding and got a plan; the sign-up conversion. */
  onboarding_complete: { platform: "web" | "app" };
  /** Back after 90+ days: refreshed the numbers, or chose "Not now". No values are sent. */
  welcome_back: { action: "updated" | "dismissed" };
  /** A meal was saved to the day. */
  meal_logged: { method: MealLogMethod };
  /** A saved meal was created (builder or "Save as a meal"). */
  saved_meal_created: { from: "builder" | "meal" };
  /** A reminder was saved from the app. */
  reminder_created: { from: "words" | "edited" };
  /** A message was sent to the AI coach. */
  coach_message: Record<string, never>;
  /** FITR8 Premium bought in the app store (trial starts count). */
  pro_purchase: { period: "month" | "year" };
  /** The Premium screen opened: which feature led there (or none), and from where. */
  paywall_view: { feature: string; source: "feature" | "onboarding" | "profile" };
  /** Landing page calorie calculator submitted (web). */
  calculator_used: Record<string, never>;
  /** "Get the app" store badge tapped (web). */
  store_click: { store: "app_store" | "play_store" };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
