import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { BadgeCheck, Camera, Package, SearchX } from "lucide-react-native";
import { useState } from "react";
import { Linking, Pressable, StyleSheet, TextInput, View } from "react-native";
import { BackHeader } from "@/components/back-header";
import { Button, Card, FieldError, Screen, Segmented, Skeleton, Stepper, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { formatInt, formatQty, MEAL_LABEL, type MealType } from "@/lib/format";
import { mealFromParam } from "@/lib/meal-param";
import { refreshDay } from "@/lib/query";
import { colors, fonts, radius } from "@/lib/theme";

interface FoodRow {
  id: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  servingSizeG: number | null;
  servingLabel: string | null;
  isLiquid: boolean;
  source: string;
  verified: boolean;
  kcalPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  sugarPer100g: number | null;
  sodiumMgPer100g: number | null;
}

type Reason = "unknown" | "invalid" | "unreachable";

/** Screens 7d (found) and 7e (not found) for one barcode. Barcode lookups never use a photo scan. */
export default function ProductRoute() {
  const params = useLocalSearchParams<{ code: string; meal?: string }>();
  const mealType = mealFromParam(params.meal);
  const product = useQuery({
    queryKey: ["barcode", params.code],
    queryFn: () => api<{ code: string; food: FoodRow | null }>(`/api/foods/barcode/${params.code}`),
    retry: false,
  });

  if (product.isPending) {
    return (
      <Screen>
        <BackHeader />
        <Skeleton height={100} />
        <Skeleton height={120} />
        <Skeleton height={220} />
      </Screen>
    );
  }
  if (product.isError || !product.data.food) {
    const err = product.error;
    const status = err instanceof ApiError ? err.status : 0;
    const reason: Reason = status === 400 ? "invalid" : status === 404 || !err ? "unknown" : "unreachable";
    return <NotFound code={params.code} mealType={mealType} reason={reason} />;
  }
  return <ProductScreen food={product.data.food} code={product.data.code} mealType={mealType} />;
}

/** Design 7d: a known product. Amount in servings (0.5 steps) or grams (5 g steps). */
function ProductScreen({ food, code, mealType }: { food: FoodRow; code: string; mealType: MealType }) {
  const hasServing = Boolean(food.servingSizeG);
  const measure = food.isLiquid ? "ml" : "g";
  const [mode, setMode] = useState<"SERVINGS" | "GRAMS">(hasServing ? "SERVINGS" : "GRAMS");
  const [servings, setServings] = useState(1);
  const [grams, setGrams] = useState(hasServing ? food.servingSizeG! : 100);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountG = mode === "SERVINGS" && food.servingSizeG ? servings * food.servingSizeG : grams;
  const k = amountG / 100;
  const fromOff = food.source === "OPEN_FOOD_FACTS";
  // Stored names carry the brand / barcode to stay unique; the brand is shown separately.
  const displayName = food.name.replace(/ · \d+$/, "").replace(food.brand ? ` (${food.brand})` : /$^/, "");

  async function add() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/meals/quick-add", {
        json:
          mode === "SERVINGS" && food.servingSizeG
            ? { foodId: food.id, mealType, quantity: servings, unit: "serving", grams: amountG }
            : { foodId: food.id, mealType, quantity: grams, unit: "g", grams },
      });
      refreshDay();
      router.dismissTo("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add it. Try again.");
      setBusy(false);
    }
  }

  const rows: [string, number | null, string][] = [
    ["Energy", food.kcalPer100g, "kcal"],
    ["Protein", food.proteinPer100g, "g"],
    ["Carbs", food.carbsPer100g, "g"],
    ["of which sugar", food.sugarPer100g, "g"],
    ["Fat", food.fatPer100g, "g"],
    ["Sodium", food.sodiumMgPer100g, "mg"],
  ];
  const fmt = (n: number, unit: string) => (unit === "kcal" ? formatInt(n) : formatQty(Math.round(n * 10) / 10));

  return (
    <Screen
      footer={
        <>
          <View style={styles.total}>
            <View>
              <Text weight={600} size={12} color={colors.ink3}>
                Total
              </Text>
              <Text variant="h1" size={26} tabular>
                {formatInt(food.kcalPer100g * k)}{" "}
                <Text weight={600} size={13} color={colors.ink3}>
                  kcal
                </Text>
              </Text>
            </View>
            <Text weight={600} size={13} color={colors.protein}>
              No AI scan used
            </Text>
          </View>
          {error && <FieldError>{error}</FieldError>}
          <Button onPress={add} loading={busy}>
            {`Add to ${MEAL_LABEL[mealType].toLowerCase()}`}
          </Button>
        </>
      }
    >
      <BackHeader />
      <View style={{ gap: 16 }}>
        <View style={styles.badge}>
          <BadgeCheck size={16} color={colors.protein} />
          <Text weight={600} size={13} color={colors.protein}>
            {fromOff || food.verified ? "Exact label values" : "Your label scan"}
          </Text>
        </View>
        <View style={{ flexDirection: "row", gap: 16, alignItems: "flex-start" }}>
          <View style={styles.pack}>
            {food.imageUrl ? (
              <Image source={{ uri: food.imageUrl }} style={StyleSheet.absoluteFill} contentFit="contain" />
            ) : (
              <Package size={32} color={colors.ink3} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            {food.brand && (
              <Text weight={600} size={13} color={colors.ink3}>
                {food.brand}
              </Text>
            )}
            <Text variant="h1" size={24}>
              {displayName}
            </Text>
            {food.servingSizeG && (
              <Text size={13} color={colors.ink2} tabular style={{ marginTop: 4 }}>
                1 serving = {formatQty(food.servingSizeG)} {measure}
                {food.servingLabel && food.servingLabel !== `${food.servingSizeG} ${measure}`
                  ? ` (${food.servingLabel})`
                  : ""}
              </Text>
            )}
          </View>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Card>
          {hasServing && (
            <Segmented
              label="Amount in"
              value={mode}
              onChange={setMode}
              options={[
                { value: "SERVINGS", label: "Servings" },
                { value: "GRAMS", label: food.isLiquid ? "Millilitres" : "Grams" },
              ]}
            />
          )}
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            {mode === "SERVINGS" ? (
              <Stepper label="Servings" value={servings} step={0.5} min={0.5} onChange={setServings} />
            ) : (
              <Stepper label={food.isLiquid ? "Millilitres" : "Grams"} value={grams} step={5} min={5} onChange={setGrams} />
            )}
            <Text weight={600} size={13} color={colors.ink3} tabular>
              {mode === "SERVINGS" ? `${formatInt(amountG)} ${measure}` : measure}
            </Text>
          </View>
        </Card>

        <View style={styles.table} accessibilityLabel={`Nutrition per 100 ${measure} and for your amount`}>
          <View style={styles.tr}>
            <Text weight={600} size={12} color={colors.ink3} style={{ flex: 1.4 }}>
              Nutrition
            </Text>
            <Text weight={600} size={12} color={colors.ink3} style={styles.num}>
              per 100 {measure}
            </Text>
            <Text weight={600} size={12} color={colors.ink3} style={styles.num}>
              You
            </Text>
          </View>
          {rows
            .filter(([, per]) => per != null)
            .map(([label, per, unit]) => {
              const sub = label.startsWith("of which");
              return (
                <View key={label} style={[styles.tr, styles.rowLine]}>
                  <Text weight={sub ? 400 : 600} color={sub ? colors.ink2 : colors.ink} style={{ flex: 1.4, paddingLeft: sub ? 12 : 0 }}>
                    {label}
                  </Text>
                  <Text color={colors.ink2} tabular style={styles.num}>
                    {fmt(per!, unit)} {unit}
                  </Text>
                  <Text weight={600} tabular style={styles.num}>
                    {fmt(per! * k, unit)} {unit}
                  </Text>
                </View>
              );
            })}
        </View>

        {fromOff && (
          <View style={{ flexDirection: "row", justifyContent: "center", flexWrap: "wrap" }}>
            <Text size={12} color={colors.ink3}>
              Data: Open Food Facts (ODbL).{" "}
            </Text>
            <Pressable
              accessibilityRole="link"
              onPress={() => Linking.openURL(`https://world.openfoodfacts.org/product/${code}`)}
            >
              <Text size={12} weight={600} color={colors.brand}>
                Report it
              </Text>
            </Pressable>
          </View>
        )}
      </View>
    </Screen>
  );
}

const TIPS = [
  "Get the whole nutrition table in frame",
  "Include the per 100 g column",
  "Tilt away from lights to avoid glare",
  "Uses 1 photo scan",
];

/** Design 7e: unknown (or invalid) barcode → photograph the label, or type the meal. */
function NotFound({ code, mealType, reason }: { code: string; mealType: MealType; reason: Reason }) {
  const [name, setName] = useState("");
  const title =
    reason === "invalid"
      ? "That barcode didn't read right"
      : reason === "unreachable"
        ? "We couldn't check this product"
        : "We don't know this product yet";

  return (
    <Screen
      footer={
        <>
          <Button
            icon={Camera}
            onPress={() =>
              router.push({
                pathname: "/log/label",
                params: { meal: mealType, barcode: code, ...(name.trim() ? { name: name.trim() } : {}) },
              })
            }
          >
            Photograph the label
          </Button>
          <Button variant="secondary" onPress={() => router.replace({ pathname: "/log/type", params: { meal: mealType } })}>
            Type it instead
          </Button>
        </>
      }
    >
      <BackHeader />
      <View style={{ gap: 8 }}>
        <View style={styles.searchX}>
          <SearchX size={24} color={colors.ink2} />
        </View>
        <Text variant="h1" size={26}>
          {title}
        </Text>
        <Text color={colors.ink2}>
          {reason === "invalid"
            ? "Scan it again, or photograph the nutrition label instead."
            : reason === "unreachable"
              ? "The product database didn't answer. Photograph the label, or try again in a minute."
              : "Photograph its nutrition label once and it's saved for next time."}
        </Text>
        {reason !== "invalid" && (
          <Text size={13} color={colors.ink3} tabular>
            Barcode {code}
          </Text>
        )}
      </View>
      <Card>
        <Text weight={600}>For a good label photo</Text>
        {TIPS.map((tip) => (
          <View key={tip} style={{ flexDirection: "row", gap: 8 }}>
            <BadgeCheck size={16} color={colors.protein} style={{ marginTop: 3 }} />
            <Text color={colors.ink2} style={{ flex: 1 }}>
              {tip}
            </Text>
          </View>
        ))}
      </Card>
      <View style={{ gap: 6 }}>
        <Text variant="label">Product name (optional)</Text>
        <TextInput
          accessibilityLabel="Product name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Parle-G Gold"
          placeholderTextColor="rgba(107,110,118,0.6)"
          style={styles.input}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.proteinSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pack: {
    width: 80,
    height: 80,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  table: { borderRadius: radius.card, backgroundColor: colors.surface, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  tr: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  num: { flex: 1, textAlign: "right" },
  total: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  searchX: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans400,
    fontSize: 16,
    color: colors.ink,
  },
});
