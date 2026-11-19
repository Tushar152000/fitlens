import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router, useLocalSearchParams } from "expo-router";
import {
  Bell,
  Camera,
  Check,
  ChevronDown,
  Crown,
  Database,
  Keyboard,
  MessageCircle,
  RefreshCw,
  ScanBarcode,
  ScanText,
  ShieldCheck,
  X,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Linking, Platform, Pressable, View } from "react-native";
import { Button, FieldError, Screen, Text } from "@/components/ui";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { useAuth } from "@/lib/auth";
import { openLegal } from "@/lib/legal";
import { LIST_PRICE, type PaywallSource } from "@/lib/premium";
import {
  buyPlan,
  manageSubscriptionUrl,
  proPlans,
  purchasesAvailable,
  restorePurchases,
  type ProPlan,
} from "@/lib/purchases";
import { billingQuery } from "@/lib/queries";
import { makeStyles, radius, useColors } from "@/lib/theme";
import { showToast } from "@/lib/toast";
import Animated from "react-native-reanimated";
import { reveal } from "@/lib/motion";

type Period = ProPlan["period"];

const SOURCES: PaywallSource[] = [
  "home_banner",
  "profile",
  "onboarding",
  "locked_photo",
  "locked_barcode",
  "locked_label",
  "locked_coach",
  "locked_reminders",
];

/** "What you get": one row open at a time, the first open by default. */
const FEATURES: { key: string; icon: LucideIcon; title: string; line: string; detail: string; example: string }[] = [
  {
    key: "photo",
    icon: Camera,
    title: "AI photo scanning",
    line: "Snap a meal, get calories and macros",
    detail: "Up to 10 photos a day. Works on mixed thalis, and you can fix any portion with one tap.",
    example: "Thali photo → 4 items, 780 kcal",
  },
  {
    key: "barcode",
    icon: ScanBarcode,
    title: "Barcode scanning",
    line: "Exact label nutrition for packed food",
    detail: "Scan biscuits, curd, protein bars or namkeen. Change the serving to half a pack or 3 biscuits.",
    example: "Curd 400 g → 64 kcal per 100 g",
  },
  {
    key: "label",
    icon: ScanText,
    title: "Nutrition label reading",
    line: "No barcode? Photograph the label",
    detail: "fitr8 reads the nutrition table on the pack and fills in exact values for you to check.",
    example: "Label photo → protein, carbs, fat",
  },
  {
    key: "coach",
    icon: MessageCircle,
    title: "AI Coach",
    line: "Nutrition and training advice",
    detail: "Ask what to eat for dinner or how to adjust today's workout. Answers use your log and your goal.",
    example: "“520 kcal left, what should I eat?”",
  },
  {
    key: "reminders",
    icon: Bell,
    title: "Unlimited reminders",
    line: "Meals, water and workouts",
    detail: "Set as many reminders as you like, at the times that suit your day. Free includes 3.",
    example: "Water every 2 hours, 8 am to 8 pm",
  },
];

/** Free vs Premium. `true` included, `false` not (a muted dash), a string = the amount. */
const TIERS: { label: string; free: boolean | string; premium: boolean | string }[] = [
  { label: "Type meals", free: true, premium: true },
  { label: "Calorie and protein targets", free: true, premium: true },
  { label: "Water and weight tracking", free: true, premium: true },
  { label: "AI photo scanning", free: false, premium: "10 a day" },
  { label: "Barcode scanning", free: false, premium: true },
  { label: "Nutrition label reading", free: false, premium: true },
  { label: "AI Coach", free: false, premium: true },
  { label: "Reminders", free: "3", premium: "Unlimited" },
];

function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
}

/**
 * Design 14c: the Premium screen. Opened from the Today banner, Profile, a locked feature's sheet
 * (`?source=`), or once after onboarding. Prices come from the store (Google Play / App Store through
 * RevenueCat) and the per-month, per-day and savings figures are computed from them; until store
 * billing is connected, "Get Premium" is a one-tap test purchase (docs/PREMIUM.md "Buying").
 *
 * Never blocks: ✕ and "Continue with Free" always return to where the user was.
 */
export default function ProScreen() {
  const c = useColors();
  const styles = useStyles();
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const params = useLocalSearchParams<{ source?: string }>();
  const source: PaywallSource = SOURCES.includes(params.source as PaywallSource)
    ? (params.source as PaywallSource)
    : "profile";
  const plans = useQuery({ queryKey: ["pro-plans"], queryFn: proPlans, enabled: purchasesAvailable });
  const billing = useQuery(billingQuery);
  const [picked, setPicked] = useState<Period>("year");
  const [open, setOpen] = useState<string>(FEATURES[0]!.key);
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storeName = Platform.OS === "ios" ? "the App Store" : "Google Play";
  const storeSettings = Platform.OS === "ios" ? "Settings › Subscriptions" : "Play Store › Subscriptions";
  const monthly = plans.data?.find((p) => p.period === "month");
  const yearly = plans.data?.find((p) => p.period === "year");
  const plan = picked === "year" ? yearly : monthly;
  // No store plans and store billing not connected: buying is a one-tap test purchase, no money.
  const testMode = !plans.data?.length && billing.data?.testPurchases === true;
  const loadingPrices = purchasesAvailable && plans.isPending;
  const canBuy = Boolean(plan) || testMode;

  // Store prices when we have them; the launch prices otherwise.
  const currency = yearly?.pkg.product.currencyCode ?? "INR";
  const yearPrice = yearly?.price ?? LIST_PRICE.year;
  const monthPrice = monthly?.price ?? LIST_PRICE.month;
  const perMonth = yearly ? money(yearly.pkg.product.price / 12, currency) : LIST_PRICE.perMonth;
  const perDayUnder = yearly ? money(Math.ceil(yearly.pkg.product.price / 365), currency) : LIST_PRICE.perDayUnder;
  const storeSaving = yearly && monthly ? monthly.pkg.product.price * 12 - yearly.pkg.product.price : null;
  const saving =
    storeSaving !== null
      ? storeSaving > 0
        ? money(storeSaving, currency)
        : null
      : plans.data?.length
        ? null
        : LIST_PRICE.yearSaving;
  const trialDays = plan?.trialDays ?? null;
  const planName = picked === "year" ? "yearly" : "monthly";
  const chosenPrice = picked === "year" ? `${yearPrice}/year` : `${monthPrice}/month`;

  const viewed = useRef(false);
  useEffect(() => {
    if (viewed.current) return;
    viewed.current = true;
    track("paywall_viewed", { source });
  }, [source]);

  // Already Premium: nothing to sell here. Go back, and open the store's subscription page.
  const alreadyPremium = billing.data?.plan === "PRO" && busy === null;
  const store = billing.data?.store;
  useEffect(() => {
    if (!alreadyPremium) return;
    router.back();
    if (store && store !== "TEST") void Linking.openURL(manageSubscriptionUrl);
  }, [alreadyPremium, store]);

  const close = () => (router.canGoBack() ? router.back() : router.replace("/today"));

  async function unlocked() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["billing"] }),
      queryClient.invalidateQueries({ queryKey: ["usage"] }),
      queryClient.invalidateQueries({ queryKey: ["reminders"] }),
      refresh(),
    ]);
  }

  async function buy() {
    if (!canBuy || busy) return;
    setBusy("buy");
    setError(null);
    track("purchase_started", { plan: planName, source });
    try {
      if (testMode) {
        await api("/api/billing/test-purchase", { json: { period: picked } });
      } else if (!(await buyPlan(plan!))) {
        track("purchase_cancelled", { plan: planName, source });
        setBusy(null);
        return;
      } else {
        // The store has charged: never show an error that invites a second purchase.
        await api("/api/billing/refresh", { method: "POST" }).catch(() => undefined);
      }
      track("purchase_succeeded", { plan: planName, source });
      close();
      showToast("Welcome to Premium");
      await unlocked().catch(() => undefined);
    } catch (err) {
      track("purchase_failed", {
        plan: planName,
        source,
        error_code: err instanceof Error && err.name ? err.name : "error",
      });
      setError(`Payment didn't go through. Try again, or check your payment method in ${storeName}.`);
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    setError(null);
    try {
      await restorePurchases();
      await api("/api/billing/refresh", { method: "POST" });
      const now = await queryClient.fetchQuery({ ...billingQuery, staleTime: 0 });
      if (now.plan === "PRO") {
        close();
        showToast("Welcome back to Premium");
        await unlocked();
        return;
      }
      setError(`No FITR8 Premium subscription found for this ${storeName} account.`);
    } catch {
      setError("Couldn't restore purchases. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  function pick(period: Period) {
    if (busy) return;
    setPicked(period);
    track("paywall_plan_selected", { plan: period === "year" ? "yearly" : "monthly" });
  }

  if (alreadyPremium) return null;

  return (
    <Screen
      gutter={20}
      footer={
        <View style={{ gap: 10 }}>
          <View style={styles.priceLine}>
            <Text size={13} weight={600} color={c.ink2} tabular>
              {trialDays
                ? `Free for ${trialDays} days, then ${chosenPrice}`
                : picked === "year"
                  ? `${perMonth} a month, billed yearly`
                  : "Billed monthly"}
            </Text>
            {picked === "year" && saving && (
              <Text size={13} weight={700} color={c.protein} tabular>
                You save {saving}
              </Text>
            )}
          </View>
          <Button onPress={buy} loading={busy === "buy"} disabled={!canBuy || busy !== null || loadingPrices}>
            {busy === "buy"
              ? "Processing…"
              : !canBuy && !loadingPrices
                ? "Coming soon"
                : trialDays
                  ? `Start ${trialDays}-day free trial`
                  : `Get Premium · ${chosenPrice}`}
          </Button>
          {error && <FieldError>{error}</FieldError>}
          {testMode && (
            <Text size={12} weight={600} color={c.ink2} center>
              Test purchase: no money is charged while FITR8 is in testing.
            </Text>
          )}
          {plan && (
            <Text size={11} color={c.ink3} center>
              Renews automatically until you cancel, at least 24 hours before the period ends, in {storeSettings}.{" "}
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
            <Pressable accessibilityRole="button" onPress={close} disabled={busy === "buy"} style={styles.link}>
              <Text size={14} weight={600} color={c.ink2}>
                Continue with Free
              </Text>
            </Pressable>
          </View>
        </View>
      }
    >
      {/* 1. Top bar */}
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

      {/* 2. Hero: what changes, side by side */}
      <View style={styles.hero}>
        <Text variant="h1" color={c.white}>
          Log meals in seconds, not minutes
        </Text>
        <Text color="rgba(255,255,255,0.78)">
          Photo and barcode scanning, an AI coach and unlimited reminders, on top of everything in Free.
        </Text>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <View style={styles.mini}>
            <View style={styles.miniHead}>
              <Keyboard size={14} color="rgba(255,255,255,0.7)" />
              <Text size={12} weight={700} color="rgba(255,255,255,0.7)">
                FREE
              </Text>
            </View>
            <Text size={13} color="rgba(255,255,255,0.85)">
              Type each item: dal, rice, sabzi, 2 roti
            </Text>
          </View>
          <View style={[styles.mini, styles.miniPremium]}>
            <View style={styles.miniHead}>
              <Camera size={14} color={c.brandGlow} />
              <Text size={12} weight={700} color={c.brandGlow}>
                PREMIUM
              </Text>
            </View>
            <Text size={13} color={c.white}>
              One photo of the thali. All 4 items found.
            </Text>
          </View>
        </View>
      </View>

      {/* 3. Choose your plan */}
      <View style={{ gap: 10 }}>
        <Text variant="h2">Choose your plan</Text>
        {loadingPrices ? (
          <>
            <Skeleton height={84} radius={radius.card} />
            <Skeleton height={72} radius={radius.card} />
          </>
        ) : (
          <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel="Choose a plan">
            <PlanCard
              selected={picked === "year"}
              disabled={busy !== null}
              onPress={() => pick("year")}
              title="Yearly"
              badge={saving ? `Save ${saving}` : undefined}
              detail={`Under ${perDayUnder} a day · best value`}
              price={yearPrice}
              priceDetail={`a year · ${perMonth}/mo`}
            />
            <PlanCard
              selected={picked === "month"}
              disabled={busy !== null}
              onPress={() => pick("month")}
              title="Monthly"
              detail="Billed every month, cancel anytime"
              price={monthPrice}
              priceDetail="a month"
            />
          </View>
        )}
      </View>

      {/* 4. What you get */}
      <View style={{ gap: 10 }}>
        <Text variant="h2">What you get</Text>
        <View style={styles.list}>
          {FEATURES.map((f, i) => {
            const expanded = open === f.key;
            return (
              <View key={f.key} style={i > 0 && styles.divider}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ expanded }}
                  accessibilityLabel={`${f.title}: ${f.line}`}
                  onPress={() => {
                    if (expanded) return;
                    setOpen(f.key);
                    track("paywall_feature_expanded", { feature: f.key });
                  }}
                  style={styles.row}
                >
                  <View style={styles.icon}>
                    <f.icon size={18} color={c.brandText} />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text weight={700}>{f.title}</Text>
                    <Text size={13} color={c.ink3}>
                      {f.line}
                    </Text>
                  </View>
                  <View style={{ transform: [{ rotate: expanded ? "180deg" : "0deg" }] }}>
                    <ChevronDown size={18} color={c.ink3} />
                  </View>
                </Pressable>
                {expanded && (
                  <Animated.View entering={reveal} style={styles.expanded}>
                    <Text size={14} color={c.ink2}>
                      {f.detail}
                    </Text>
                    <View style={styles.example}>
                      <Text size={12} weight={700} color={c.brandText} tabular>
                        {f.example}
                      </Text>
                    </View>
                  </Animated.View>
                )}
              </View>
            );
          })}
        </View>
      </View>

      {/* 5. Free vs Premium */}
      <View style={{ gap: 10 }}>
        <Text variant="h2">Free and Premium</Text>
        <View style={styles.list}>
          <View style={[styles.tierRow, { backgroundColor: c.sunken }]}>
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
          {TIERS.map((r) => (
            <View
              key={r.label}
              style={[styles.tierRow, styles.divider]}
              accessible
              accessibilityLabel={`${r.label}: Free ${cellLabel(r.free)}, Premium ${cellLabel(r.premium)}`}
            >
              <Text size={14} style={{ flex: 1 }}>
                {r.label}
              </Text>
              <View style={styles.col}>
                <Cell value={r.free} />
              </View>
              <View style={styles.col}>
                <Cell value={r.premium} premium />
              </View>
            </View>
          ))}
        </View>
      </View>

      {/* 6. Billing reassurance */}
      <View style={styles.list}>
        {(
          [
            [
              ShieldCheck,
              testMode ? "Nothing is charged while FITR8 is in testing" : `Paid securely through ${storeName}`,
            ],
            [RefreshCw, `Cancel anytime in ${storeSettings}`],
            [Database, "Your logs stay if you go back to Free"],
          ] as const
        ).map(([Icon, text], i) => (
          <View key={text} style={[styles.row, i > 0 && styles.divider]}>
            <Icon size={18} color={c.protein} />
            <Text size={14} style={{ flex: 1 }}>
              {text}
            </Text>
          </View>
        ))}
      </View>

      {/* 7. Questions */}
      <View style={{ gap: 12 }}>
        <Text variant="h2">Questions</Text>
        {(
          [
            [
              "What happens after 10 photos in a day?",
              "You can still scan barcodes and type meals. Photo scans reset at midnight.",
            ],
            ["Can I switch between monthly and yearly?", `Yes, any time from ${storeSettings}.`],
            ["Is my Free data safe if I upgrade?", "Yes. Your meals, targets and streak carry over as they are."],
          ] as const
        ).map(([q, a]) => (
          <View key={q} style={{ gap: 4 }}>
            <Text weight={700}>{q}</Text>
            <Text size={14} color={c.ink2}>
              {a}
            </Text>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const cellLabel = (v: boolean | string) => (v === true ? "included" : v === false ? "not included" : v);

function Cell({ value, premium }: { value: boolean | string; premium?: boolean }) {
  const c = useColors();
  if (value === true) return <Check size={18} color={premium ? c.brandText : c.protein} strokeWidth={2.6} />;
  if (value === false)
    return (
      <Text size={16} weight={700} color={c.ink3}>
        —
      </Text>
    );
  return (
    <Text size={12} weight={700} color={premium ? c.brandText : c.ink2} center>
      {value}
    </Text>
  );
}

function PlanCard({
  selected,
  disabled,
  onPress,
  title,
  badge,
  detail,
  price,
  priceDetail,
}: {
  selected: boolean;
  disabled: boolean;
  onPress: () => void;
  title: string;
  badge?: string;
  detail: string;
  price: string;
  priceDetail: string;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected, disabled }}
      accessibilityLabel={`${title}, ${price} ${priceDetail}${badge ? `, ${badge}` : ""}. ${detail}`}
      onPress={onPress}
      disabled={disabled}
      style={[styles.plan, selected && styles.planSelected, disabled && { opacity: 0.6 }]}
    >
      <View style={[styles.radio, selected && { borderColor: c.brand, backgroundColor: c.brand }]}>
        {selected && <Check size={14} color={c.white} strokeWidth={3} />}
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <Text weight={700} size={16}>
            {title}
          </Text>
          {badge && (
            <View style={styles.save}>
              <Text size={12} weight={700} color={c.protein} tabular>
                {badge}
              </Text>
            </View>
          )}
        </View>
        <Text size={13} color={c.ink3}>
          {detail}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text weight={700} size={18} tabular>
          {price}
        </Text>
        <Text size={12} color={c.ink3} tabular>
          {priceDetail}
        </Text>
      </View>
    </Pressable>
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
    gap: 12,
  },
  mini: { flex: 1, gap: 6, padding: 12, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.08)" },
  miniPremium: { backgroundColor: "rgba(168,85,247,0.18)", borderWidth: 1, borderColor: "rgba(168,85,247,0.45)" },
  miniHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 72,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.lineStrong,
    backgroundColor: c.surface,
  },
  planSelected: { borderWidth: 2, borderColor: c.brandGlow, backgroundColor: c.brandSoft },
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
  list: {
    backgroundColor: c.surface,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.line,
    overflow: "hidden",
  },
  divider: { borderTopWidth: 1, borderTopColor: c.line },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 56,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: c.brandSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  expanded: { paddingRight: 14, paddingBottom: 14, paddingLeft: 62, gap: 8 },
  example: {
    alignSelf: "flex-start",
    backgroundColor: c.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  tierRow: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 12 },
  col: { width: 76, alignItems: "center" },
  priceLine: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  links: { flexDirection: "row", justifyContent: "center", gap: 16 },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
}));
