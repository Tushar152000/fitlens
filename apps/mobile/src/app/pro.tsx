import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  BarChart3,
  Bell,
  Camera,
  Check,
  ChevronRight,
  Crown,
  MessageCircle,
  Minus,
  ScanBarcode,
  ScanText,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Platform, Pressable, View } from "react-native";
import { Button, FieldError, Screen, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { openLegal } from "@/lib/legal";
import type { PremiumFeature } from "@/lib/premium";
import { buyPlan, proPlans, purchasesAvailable, restorePurchases, type ProPlan } from "@/lib/purchases";
import { billingQuery } from "@/lib/queries";
import { makeStyles, radius, useColors } from "@/lib/theme";

/** Shown when the store can't give prices (no SDK key yet, or offline). Matches docs/PREMIUM.md. */
const LIST_PRICE = { month: "₹149", year: "₹1,499", trialDays: 7 };

type Hero = { eyebrow: string; title: string; sub: string };

/** The screen opens on what the user just tried: relevance first, then the rest of Premium. */
const HEROES: Record<PremiumFeature | "default" | "onboarding", Hero> = {
  barcode: {
    eyebrow: "Premium feature",
    title: "Scan a barcode, done",
    sub: "Point at any pack and get its exact label nutrition in a second.",
  },
  photo_scan: {
    eyebrow: "Premium feature",
    title: "Snap your plate. We'll count it.",
    sub: "AI reads your meal from a photo: dal, roti, sabzi and all.",
  },
  label_scan: {
    eyebrow: "Premium feature",
    title: "Read any nutrition label",
    sub: "Photograph the label and get the exact values, no typing.",
  },
  coach: {
    eyebrow: "Premium feature",
    title: "Your personal AI coach",
    sub: "Answers grounded in sports science and your own meals, workouts and goal.",
  },
  reminders: {
    eyebrow: "You've used your 3 free reminders",
    title: "As many reminders as you need",
    sub: "Creatine, stretching, weigh-ins: set every reminder that keeps you on track.",
  },
  onboarding: {
    eyebrow: "Your plan is ready",
    title: "Reach your goal faster with Premium",
    sub: "More intelligence. Better guidance. Smarter fitness.",
  },
  default: {
    eyebrow: "FITR8 Premium",
    title: "Get more from your plan",
    sub: "More intelligence. Better guidance. Smarter fitness.",
  },
};

type Benefit = { feature?: PremiumFeature; icon: LucideIcon; title: string; sub: string; soon?: boolean };

/** What Premium adds, in docs/PREMIUM.md order. Only "soon" items aren't built yet. */
const BENEFITS: Benefit[] = [
  { feature: "barcode", icon: ScanBarcode, title: "Barcode scanning", sub: "Exact label nutrition for packed food." },
  {
    feature: "photo_scan",
    icon: Camera,
    title: "AI photo scanning",
    sub: "Snap a meal, get calories and macros. 10 a day.",
  },
  {
    feature: "label_scan",
    icon: ScanText,
    title: "Nutrition label reading",
    sub: "Photograph any label for exact values.",
  },
  {
    feature: "coach",
    icon: MessageCircle,
    title: "AI Coach",
    sub: "Nutrition, training and running advice made for you.",
  },
  { feature: "reminders", icon: Bell, title: "Unlimited reminders", sub: "Free includes 3 of your own." },
  { icon: BarChart3, title: "Reports and insights", sub: "Detailed weekly and monthly reports.", soon: true },
];

/** Where a new Premium user can try each feature right away ("What you just unlocked"). */
const TRY: Partial<Record<PremiumFeature, "/log" | "/coach" | "/reminders">> = {
  barcode: "/log",
  photo_scan: "/log",
  coach: "/coach",
  reminders: "/reminders",
};

/** Free vs Premium at a glance. `true` = included, `false` = not, a string = the amount. */
const COMPARE: { label: string; free: boolean | string; premium: boolean | string }[] = [
  { label: "Type meals, calories and macros", free: true, premium: true },
  { label: "Saved meals, water and weight", free: true, premium: true },
  { label: "Workouts, sets and reps", free: true, premium: true },
  { label: "Custom reminders", free: "3", premium: "Unlimited" },
  { label: "Barcode scanning", free: false, premium: true },
  { label: "AI photo and label scanning", free: false, premium: "10 a day" },
  { label: "AI Coach", free: false, premium: true },
  { label: "Detailed reports and insights", free: false, premium: "Soon" },
];

const isFeature = (v: unknown): v is PremiumFeature => typeof v === "string" && BENEFITS.some((b) => b.feature === v);

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/**
 * FITR8 Premium (modal), opened by any Premium feature a free user taps (`?feature=`), once after
 * onboarding (`?source=onboarding`) and from Profile. Prices and the trial come from the store through
 * RevenueCat; after a purchase or restore the API re-reads RevenueCat so features unlock at once.
 *
 * Design (docs/DESIGN.md "Premium"): the feature the user tried leads (relevance); yearly is
 * preselected and shown per month, with the saving in rupees (anchoring); the trial timeline says
 * exactly when money moves (risk reversal, no surprises); one purple action; free is never shamed:
 * "Continue with Free" is always visible.
 */
export default function ProScreen() {
  const c = useColors();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const params = useLocalSearchParams<{ feature?: string; source?: string }>();
  const feature = isFeature(params.feature) ? params.feature : undefined;
  const onboarding = params.source === "onboarding";
  const plans = useQuery({ queryKey: ["pro-plans"], queryFn: proPlans, enabled: purchasesAvailable });
  const billing = useQuery(billingQuery);
  const [picked, setPicked] = useState<ProPlan["period"]>("year");
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  /** The store charged but our server couldn't confirm yet: never show an error that invites a second purchase. */
  const [syncPending, setSyncPending] = useState(false);

  const tracked = useRef(false);
  useEffect(() => {
    if (tracked.current) return;
    tracked.current = true;
    track("paywall_view", {
      feature: feature ?? "none",
      source: onboarding ? "onboarding" : feature ? "feature" : "profile",
    });
  }, [feature, onboarding]);

  const monthly = plans.data?.find((p) => p.period === "month");
  const yearly = plans.data?.find((p) => p.period === "year");
  const plan = plans.data?.find((p) => p.period === picked) ?? plans.data?.[0];
  const isPremium = done || billing.data?.plan === "PRO";
  const store = Platform.OS === "ios" ? "App Store" : "Google Play";
  const hero = isPremium
    ? { eyebrow: "FITR8 Premium", title: "You're on Premium", sub: "Everything is unlocked. Thanks for backing FITR8." }
    : HEROES[onboarding ? "onboarding" : (feature ?? "default")];
  // No store plans and store billing not connected: buying is a one-tap test purchase, no money.
  const testMode = !plan && billing.data?.testPurchases === true;
  const trialDays = testMode ? null : (plan?.trialDays ?? (plans.data?.length ? null : LIST_PRICE.trialDays));

  // Yearly framed per month, and the saving in rupees: concrete numbers persuade more than percentages.
  const currency = yearly?.pkg.product.currencyCode ?? "INR";
  const yearlyPerMonth = yearly ? money(yearly.pkg.product.price / 12, currency) : "₹125";
  const saving =
    monthly && yearly ? monthly.pkg.product.price * 12 - yearly.pkg.product.price : monthly || yearly ? 0 : 289;
  const yearPrice = yearly?.price ?? LIST_PRICE.year;
  const monthPrice = monthly?.price ?? LIST_PRICE.month;
  const chosenPrice = picked === "year" ? `${yearPrice}/year` : `${monthPrice}/month`;

  const ordered = feature
    ? [...BENEFITS.filter((b) => b.feature === feature), ...BENEFITS.filter((b) => b.feature !== feature)]
    : BENEFITS;

  async function afterStore() {
    await api("/api/billing/refresh", { method: "POST" });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["billing"] }),
      queryClient.invalidateQueries({ queryKey: ["usage"] }),
      queryClient.invalidateQueries({ queryKey: ["reminders"] }),
      refresh(),
    ]);
  }

  async function buy() {
    if (!plan && !testMode) return;
    setBusy("buy");
    setError(null);
    try {
      if (testMode) {
        await api("/api/billing/test-purchase", { json: { period: picked } });
        setDone(true);
        await afterStore();
      } else if (plan && (await buyPlan(plan))) {
        track("pro_purchase", { period: plan.period });
        setDone(true);
        await afterStore().catch(() => setSyncPending(true));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setError(null);
    try {
      await restorePurchases();
      await afterStore();
      const now = await queryClient.fetchQuery(billingQuery);
      if (now.plan === "PRO") setDone(true);
      else setError(`No FITR8 Premium subscription found for this ${store} account.`);
    } catch {
      setError("Couldn't restore purchases. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace("/today"));
  const cta = testMode
    ? `Get Premium · ${chosenPrice}`
    : !plan
      ? "Coming soon"
      : trialDays
        ? `Start ${trialDays}-day free trial`
        : `Get Premium for ${chosenPrice}`;

  return (
    <Screen
      gutter={20}
      footer={
        isPremium ? (
          <>
            {syncPending && (
              <Text size={13} color={c.ink2} center>
                Payment received. Premium will switch on in a moment; if it doesn&apos;t, use Restore purchases.
              </Text>
            )}
            <Button onPress={close}>{feature ? "Continue" : "Done"}</Button>
          </>
        ) : (
          <View style={{ gap: 10 }}>
            {error && <FieldError>{error}</FieldError>}
            <Button onPress={buy} loading={busy === "buy"} disabled={!(plan || testMode) || busy !== null}>
              {cta}
            </Button>
            {testMode && (
              <Text size={13} weight={600} color={c.ink2} center>
                Test purchase: no money is charged while FITR8 is in testing.
              </Text>
            )}
            {plan && (
              <Text size={13} weight={600} color={c.ink2} center>
                {trialDays ? `₹0 today · ${chosenPrice} after ${trialDays} days · ` : ""}Cancel anytime
              </Text>
            )}
            {plan && (
              <Text size={11} color={c.ink3} center>
                {trialDays ? `Free for ${trialDays} days, then ` : ""}
                {plan.price} a {plan.period}. Renews automatically until you cancel; cancel at least 24 hours before the
                period ends in your {store} settings.{" "}
                <Text size={11} color={c.brandText} weight={600} onPress={() => openLegal("terms")}>
                  Terms
                </Text>
                {" · "}
                <Text size={11} color={c.brandText} weight={600} onPress={() => openLegal("privacy")}>
                  Privacy
                </Text>
              </Text>
            )}
            <View style={styles.links}>
              {purchasesAvailable && (
                <Pressable accessibilityRole="button" onPress={restore} disabled={busy !== null} style={styles.link}>
                  <Text size={14} weight={600} color={c.ink2}>
                    {busy === "restore" ? "Restoring…" : "Restore purchases"}
                  </Text>
                </Pressable>
              )}
              <Pressable accessibilityRole="button" onPress={close} disabled={busy !== null} style={styles.link}>
                <Text size={14} weight={600} color={c.ink2}>
                  Continue with Free
                </Text>
              </Pressable>
            </View>
          </View>
        )
      }
    >
      <View style={styles.topRow}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <View style={styles.crown}>
            <Crown size={16} color={c.white} strokeWidth={2.2} />
          </View>
          <Text weight={700}>FITR8 Premium</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={close} style={styles.close}>
          <X size={22} color={c.ink2} />
        </Pressable>
      </View>

      {/* Hero: the dark panel sets Premium apart; the purple glow is the only accent. */}
      <View style={styles.hero}>
        <View style={styles.eyebrow}>
          <Text size={12} weight={700} color={c.brandGlow}>
            {hero.eyebrow.toUpperCase()}
          </Text>
        </View>
        <Text variant="h1" color={c.white}>
          {hero.title}
        </Text>
        <Text color="rgba(255,255,255,0.78)">{hero.sub}</Text>
      </View>

      {!isPremium && (
        <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Choose a plan">
          <PlanOption
            selected={picked === "year"}
            onPress={() => setPicked("year")}
            title="Yearly"
            price={`${yearPrice}/year`}
            detail={`Just ${yearlyPerMonth}/month`}
            badge={saving > 0 ? `Save ${money(saving, currency)}` : undefined}
          />
          <PlanOption
            selected={picked === "month"}
            onPress={() => setPicked("month")}
            title="Monthly"
            price={`${monthPrice}/month`}
            detail="Billed every month"
          />
          {purchasesAvailable && plans.isPending && (
            <Text size={13} color={c.ink3}>
              Loading prices from {store}…
            </Text>
          )}
          {!plans.data?.length && !testMode && !(purchasesAvailable && plans.isPending) && (
            <Text size={13} color={c.ink3}>
              Premium is coming soon. These are the launch prices.
            </Text>
          )}
        </View>
      )}

      {!isPremium && trialDays ? <TrialTimeline days={trialDays} price={chosenPrice} /> : null}

      <View style={{ gap: 12 }}>
        <Text variant="h2">
          {done ? "What you just unlocked" : isPremium ? "Included in your plan" : "Everything in Free, plus"}
        </Text>
        <View style={styles.list}>
          {ordered.map((b, i) => {
            const lead = !isPremium && b.feature !== undefined && b.feature === feature;
            const tryRoute = isPremium && b.feature ? TRY[b.feature] : undefined;
            const row = [styles.benefit, i > 0 && styles.divider, lead && styles.lead];
            const wrap = (children: ReactNode) =>
              tryRoute ? (
                <Pressable
                  key={b.title}
                  accessibilityRole="button"
                  accessibilityLabel={`Try ${b.title}`}
                  onPress={() => router.replace(tryRoute)}
                  style={({ pressed }) => [...row, pressed && { backgroundColor: c.sunken }]}
                >
                  {children}
                  <Text size={13} weight={600} color={c.brandText}>
                    Try it
                  </Text>
                  <ChevronRight size={18} color={c.brandText} />
                </Pressable>
              ) : (
                <View key={b.title} style={row}>
                  {children}
                </View>
              );
            return wrap(
              <>
                <View style={[styles.benefitIcon, lead && { backgroundColor: c.brand }]}>
                  <b.icon size={18} color={lead ? c.white : c.brandText} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text weight={600}>{b.title}</Text>
                    {b.soon && (
                      <View style={styles.soon}>
                        <Text size={11} weight={700} color={c.ink2}>
                          SOON
                        </Text>
                      </View>
                    )}
                  </View>
                  <Text size={13} color={c.ink3}>
                    {b.sub}
                  </Text>
                </View>
              </>,
            );
          })}
        </View>
      </View>

      {!isPremium && <Compare />}
    </Screen>
  );
}

function PlanOption({
  selected,
  onPress,
  title,
  price,
  detail,
  badge,
}: {
  selected: boolean;
  onPress: () => void;
  title: string;
  price: string;
  detail: string;
  badge?: string;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}, ${price}, ${detail}${badge ? `, ${badge}` : ""}`}
      onPress={onPress}
      style={[styles.plan, selected && styles.planSelected]}
    >
      <View style={[styles.radio, selected && { borderColor: c.brand, backgroundColor: c.brand }]}>
        {selected && <Check size={14} color={c.white} strokeWidth={3} />}
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text weight={700}>{title}</Text>
          {badge && (
            <View style={styles.save}>
              <Text size={12} weight={700} color={c.protein}>
                {badge}
              </Text>
            </View>
          )}
        </View>
        <Text size={13} color={c.ink3}>
          {detail}
        </Text>
      </View>
      <Text weight={700}>{price}</Text>
    </Pressable>
  );
}

/** When money moves, stated plainly: today is free, the first charge comes after the trial. */
function TrialTimeline({ days, price }: { days: number; price: string }) {
  const c = useColors();
  const styles = useStyles();
  const steps = [
    { when: "Today", what: "Every Premium feature unlocks. You pay ₹0." },
    { when: `Day ${days}`, what: `Your plan starts at ${price}. Cancel before then and you pay nothing.` },
  ];
  return (
    <View style={styles.timeline} accessible accessibilityLabel={steps.map((s) => `${s.when}: ${s.what}`).join(" ")}>
      {steps.map((s, i) => (
        <View key={s.when} style={{ flexDirection: "row", gap: 12 }}>
          <View style={{ alignItems: "center", width: 14 }}>
            <View style={[styles.dot, i === 0 && { backgroundColor: c.brand, borderColor: c.brand }]} />
            {i < steps.length - 1 && <View style={styles.rail} />}
          </View>
          <View style={{ flex: 1, paddingBottom: i < steps.length - 1 ? 14 : 0, gap: 2 }}>
            <Text weight={700} size={14}>
              {s.when}
            </Text>
            <Text size={13} color={c.ink2}>
              {s.what}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
}

/** Free vs Premium. Free's missing items are a quiet dash, never a red cross: nothing to be ashamed of. */
function Compare() {
  const c = useColors();
  const styles = useStyles();
  const cell = (v: boolean | string, premium: boolean) =>
    v === true ? (
      <Check size={18} color={premium ? c.brandText : c.protein} strokeWidth={2.6} />
    ) : v === false ? (
      <Minus size={18} color={c.ink3} />
    ) : (
      <Text size={12} weight={700} color={premium ? c.brandText : c.ink2} center>
        {v}
      </Text>
    );
  return (
    <View style={{ gap: 12 }}>
      <Text variant="h2">Free and Premium</Text>
      <View style={styles.list}>
        <View style={[styles.row, { paddingVertical: 10 }]}>
          <Text size={12} weight={700} color={c.ink3} style={{ flex: 1 }}>
            FEATURE
          </Text>
          <Text size={12} weight={700} color={c.ink3} style={styles.col} center>
            FREE
          </Text>
          <Text size={12} weight={700} color={c.brandText} style={styles.col} center>
            PREMIUM
          </Text>
        </View>
        {COMPARE.map((r) => (
          <View
            key={r.label}
            style={[styles.row, styles.divider]}
            accessible
            accessibilityLabel={`${r.label}: Free ${r.free === true ? "yes" : r.free === false ? "no" : r.free}, Premium ${
              r.premium === true ? "yes" : r.premium
            }`}
          >
            <Text size={14} style={{ flex: 1 }}>
              {r.label}
            </Text>
            <View style={styles.col}>{cell(r.free, false)}</View>
            <View style={styles.col}>{cell(r.premium, true)}</View>
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: -8 },
  crown: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: c.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  hero: {
    backgroundColor: c.panel,
    borderWidth: 1,
    borderColor: c.panelLine,
    borderRadius: radius.card,
    padding: 20,
    gap: 10,
  },
  eyebrow: { flexDirection: "row" },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 68,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.lineStrong,
    backgroundColor: c.surface,
  },
  planSelected: { borderWidth: 2, borderColor: c.brand, backgroundColor: c.brandSoft },
  save: { backgroundColor: c.proteinSoft, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: c.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  timeline: { backgroundColor: c.surface, borderRadius: radius.card, borderWidth: 1, borderColor: c.line, padding: 16 },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: c.lineStrong,
    backgroundColor: c.surface,
  },
  rail: { flex: 1, width: 2, backgroundColor: c.line, marginVertical: 2 },
  list: {
    backgroundColor: c.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.line,
    overflow: "hidden",
  },
  benefit: { flexDirection: "row", gap: 12, alignItems: "center", paddingHorizontal: 14, paddingVertical: 12 },
  lead: { backgroundColor: c.brandSoft },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  benefitIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  soon: { backgroundColor: c.chip, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  col: { width: 72, alignItems: "center" },
  links: { flexDirection: "row", justifyContent: "center", gap: 16 },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
}));
