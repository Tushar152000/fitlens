/**
 * Product analytics events, sent to Google Analytics 4 by the web (gtag, after cookie consent) and
 * the app (Firebase Analytics). Same names and params on every client so reports line up.
 *
 * Privacy rule: params are coarse labels only. Never send health values (weight, kcal, body fat,
 * goal targets), names, emails, photos or free text. The user id sent to Analytics is FITR8's
 * internal id, never an email. Setup and data notes: docs/ANALYTICS.md.
 */
export type MealLogMethod = "photo" | "type" | "barcode" | "label" | "usual" | "saved";

/** Premium features as analytics labels. */
export type PremiumFeatureLabel = "photo" | "barcode" | "label" | "coach" | "reminders";

/** Where the Premium screen was opened from. */
export type PaywallSource =
  | "home_banner"
  | "profile"
  | "onboarding"
  | "locked_photo"
  | "locked_barcode"
  | "locked_label"
  | "locked_coach"
  | "locked_reminders";

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
  /** Premium banner on Today (free users): shown, tapped, or hidden for the day. */
  premium_banner_shown: { meals_typed_today: number };
  premium_banner_tapped: { meals_typed_today: number };
  premium_banner_dismissed: { meals_typed_today: number };
  /** A free user tapped a Premium feature: the locked sheet opened, or they took its free path. */
  premium_locked_sheet_shown: { feature: PremiumFeatureLabel };
  premium_locked_free_path: { feature: PremiumFeatureLabel };
  /** The Premium screen opened, and from where (compare which entry point converts). */
  paywall_viewed: { source: PaywallSource };
  paywall_plan_selected: { plan: "yearly" | "monthly" };
  paywall_feature_expanded: { feature: string };
  /** Buying Premium (store or test purchase). Trial starts count as succeeded. */
  purchase_started: { plan: "yearly" | "monthly"; source: PaywallSource };
  purchase_succeeded: { plan: "yearly" | "monthly"; source: PaywallSource };
  purchase_failed: { plan: "yearly" | "monthly"; source: PaywallSource; error_code: string };
  purchase_cancelled: { plan: "yearly" | "monthly"; source: PaywallSource };
  /** Landing page calorie calculator submitted (web). */
  calculator_used: Record<string, never>;
  /** "Get the app" store badge tapped (web). */
  store_click: { store: "app_store" | "play_store" };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
