import { useQuery, useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import { Camera, Check, Crown, MessageCircle, ScanText, Sparkles, X } from "lucide-react-native";
import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import { Button, FieldError, Screen, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { openLegal } from "@/lib/legal";
import { buyPlan, proPlans, purchasesAvailable, restorePurchases, type ProPlan } from "@/lib/purchases";
import { billingQuery } from "@/lib/queries";
import { colors, radius } from "@/lib/theme";

/** Only what Pro actually unlocks today (docs/PREMIUM.md). */
const BENEFITS = [
  { icon: Camera, title: "30 photo scans a day", sub: "Instead of 3. Typing meals stays free and unlimited." },
  { icon: MessageCircle, title: "More AI coach messages", sub: "Ask about meals, training and your plan all day." },
  { icon: ScanText, title: "Photograph nutrition labels", sub: "For packaged food the barcode doesn't know yet." },
  { icon: Sparkles, title: "Meal ideas and 30-day insights", sub: "Coming soon, included in Pro." },
];

/**
 * FITR8 Pro paywall (modal). Prices and the trial come from the store through RevenueCat; after a
 * purchase or restore the API re-reads RevenueCat so limits lift immediately.
 */
export default function ProScreen() {
  const queryClient = useQueryClient();
  const { refresh } = useAuth();
  const plans = useQuery({ queryKey: ["pro-plans"], queryFn: proPlans, enabled: purchasesAvailable });
  const billing = useQuery(billingQuery);
  const [picked, setPicked] = useState<ProPlan["period"]>("year");
  const [busy, setBusy] = useState<"buy" | "restore" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const plan = plans.data?.find((p) => p.period === picked) ?? plans.data?.[0];
  const monthly = plans.data?.find((p) => p.period === "month");
  const yearly = plans.data?.find((p) => p.period === "year");
  const isPro = billing.data?.plan === "PRO";
  const store = Platform.OS === "ios" ? "App Store" : "Google Play";

  async function afterStore() {
    await api("/api/billing/refresh", { method: "POST" });
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["billing"] }),
      queryClient.invalidateQueries({ queryKey: ["usage"] }),
      refresh(),
    ]);
  }

  async function buy() {
    if (!plan) return;
    setBusy("buy");
    setError(null);
    try {
      if (await buyPlan(plan)) {
        await afterStore();
        setDone(true);
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
      else setError(`No FITR8 Pro subscription found for this ${store} account.`);
    } catch {
      setError("Couldn't restore purchases. Check your connection and try again.");
    } finally {
      setBusy(null);
    }
  }

  const cta = !plan
    ? "Not available yet"
    : plan.trialDays
      ? `Start ${plan.trialDays}-day free trial`
      : `Subscribe for ${plan.price} a ${plan.period}`;

  return (
    <Screen
      gutter={24}
      footer={
        done || isPro ? (
          <Button onPress={() => router.back()}>Done</Button>
        ) : (
          <>
            {error && <FieldError>{error}</FieldError>}
            <Button onPress={buy} loading={busy === "buy"} disabled={!plan || busy !== null}>
              {cta}
            </Button>
            {plan && (
              <Text size={12} color={colors.ink3} center>
                {plan.trialDays ? `Free for ${plan.trialDays} days, then ` : ""}
                {plan.price} a {plan.period}. Renews automatically until you cancel; cancel at least 24 hours before the
                period ends in your {store} settings.{" "}
                <Text size={12} color={colors.brand} weight={600} onPress={() => openLegal("terms")}>
                  Terms
                </Text>
                {" · "}
                <Text size={12} color={colors.brand} weight={600} onPress={() => openLegal("privacy")}>
                  Privacy
                </Text>
              </Text>
            )}
            {purchasesAvailable && (
              <Pressable accessibilityRole="button" onPress={restore} disabled={busy !== null} style={styles.link}>
                <Text weight={600} color={colors.ink2}>
                  {busy === "restore" ? "Restoring…" : "Restore purchases"}
                </Text>
              </Pressable>
            )}
          </>
        )
      }
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <View style={styles.crown}>
          <Crown size={24} color={colors.white} />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.close}
        >
          <X size={22} color={colors.ink2} />
        </Pressable>
      </View>

      <View style={{ gap: 8 }}>
        <Text variant="h1">{done || isPro ? "You're on FITR8 Pro" : "FITR8 Pro"}</Text>
        <Text color={colors.ink2}>
          {done || isPro
            ? "Your limits are lifted. Thanks for supporting FITR8."
            : "Log more, ask more, and get the most from your plan."}
        </Text>
      </View>

      <View style={{ gap: 10 }}>
        {BENEFITS.map(({ icon: Icon, title, sub }) => (
          <View key={title} style={styles.benefit}>
            <View style={styles.benefitIcon}>
              <Icon size={19} color={colors.brand} />
            </View>
            <View style={{ flex: 1 }}>
              <Text weight={600}>{title}</Text>
              <Text size={13} color={colors.ink3}>
                {sub}
              </Text>
            </View>
          </View>
        ))}
      </View>

      {!(done || isPro) &&
        (plans.data?.length ? (
          <View style={{ gap: 10 }} accessibilityRole="radiogroup">
            {[yearly, monthly].filter(Boolean).map((p) => {
              const selected = p!.period === plan?.period;
              const saving =
                p!.period === "year" && monthly && yearly
                  ? Math.round((1 - yearly.pkg.product.price / (monthly.pkg.product.price * 12)) * 100)
                  : null;
              return (
                <Pressable
                  key={p!.period}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => setPicked(p!.period)}
                  style={[styles.plan, selected && styles.planSelected]}
                >
                  <View style={{ flex: 1 }}>
                    <Text weight={600}>{p!.period === "year" ? "Yearly" : "Monthly"}</Text>
                    <Text size={13} color={colors.ink3}>
                      {p!.trialDays ? `${p!.trialDays} days free, then ` : ""}
                      {p!.price} a {p!.period}
                    </Text>
                  </View>
                  {saving != null && saving > 0 && (
                    <View style={styles.save}>
                      <Text size={12} weight={700} color={colors.white}>
                        Save {saving}%
                      </Text>
                    </View>
                  )}
                  <View style={[styles.radio, selected && { borderColor: colors.brand }]}>
                    {selected && <Check size={14} color={colors.brand} strokeWidth={3} />}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : (
          <View style={styles.note}>
            <Text size={13} color={colors.ink2}>
              {purchasesAvailable && plans.isPending
                ? "Loading prices…"
                : "Pro is coming soon: ₹199 a month or ₹1,499 a year, with a 7-day free trial."}
            </Text>
          </View>
        ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  crown: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: -10 },
  benefit: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 14,
  },
  benefitIcon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#f3e8ff",
    alignItems: "center",
    justifyContent: "center",
  },
  plan: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  planSelected: { borderWidth: 2, borderColor: colors.brand },
  save: { backgroundColor: colors.brand, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.lineStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  note: { backgroundColor: colors.sunken, borderRadius: radius.card, padding: 14 },
  link: { minHeight: 44, alignItems: "center", justifyContent: "center" },
});
