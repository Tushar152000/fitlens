import { useQuery } from "@tanstack/react-query";
import type { LabelScanDto } from "@fitr8/contracts";
import { ProductSkeleton } from "@/components/skeletons";
import { router, useLocalSearchParams } from "expo-router";
import { BadgeCheck, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { TextInput, View } from "react-native";
import { BackHeader } from "@/components/back-header";
import { QueryError } from "@/components/query-error";
import { Button, Card, FieldError, NumberField, Screen, Stepper, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { MealWhen } from "@/components/log/meal-when";
import { formatInt, MEAL_LABEL } from "@/lib/format";
import { labelAddsUp } from "@/lib/label";
import { useMealChoice } from "@/lib/meal-param";
import { refreshDay } from "@/lib/query";
import { showDay } from "@/lib/view-day";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";

type ScanDto = LabelScanDto;

const str = (n: number | null) => (n == null ? "" : String(Math.round(n * 10) / 10));
const num = (s: string) => (s.trim() === "" ? NaN : Number(s));

/** Screen 7g: check the values the AI read, then save the food and add it to the meal. */
export default function CheckLabelScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const scan = useQuery({
    queryKey: ["label", params.id],
    queryFn: () => api<ScanDto>(`/api/foods/label/${params.id}`),
  });
  if (scan.isPending) {
    return (
      <Screen>
        <BackHeader />
        <ProductSkeleton />
      </Screen>
    );
  }
  if (scan.isError) {
    return (
      <Screen>
        <BackHeader />
        <QueryError error={scan.error} onRetry={() => scan.refetch()} />
      </Screen>
    );
  }
  return <CheckLabel scan={scan.data} />;
}

function CheckLabel({ scan }: { scan: ScanDto }) {
  const c = useColors();
  const styles = useStyles();
  const { mealType, setMealType, date, setDate, dateBody, params } = useMealChoice();
  const [name, setName] = useState(scan.name);
  const [kcal, setKcal] = useState(str(scan.per100g.kcal));
  const [protein, setProtein] = useState(str(scan.per100g.protein));
  const [carbs, setCarbs] = useState(str(scan.per100g.carbs));
  const [fat, setFat] = useState(str(scan.per100g.fat));
  const [serving, setServing] = useState(str(scan.servingSizeG ?? 100));
  const [servings, setServings] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = { kcal: num(kcal), protein: num(protein), carbs: num(carbs), fat: num(fat) };
  const allNumbers = Object.values(values).every((v) => Number.isFinite(v) && v >= 0);
  const check = allNumbers ? labelAddsUp(values) : null;
  const servingG = num(serving);
  const grams = Number.isFinite(servingG) && servingG > 0 ? servingG * servings : 0;
  // The API takes at most 100 servings and 5000 g per item: the stepper stops there.
  const maxServings =
    Number.isFinite(servingG) && servingG > 0
      ? Math.max(0.5, Math.min(100, Math.floor((5000 / servingG) * 2) / 2))
      : 100;
  const total = allNumbers ? (values.kcal * grams) / 100 : 0;
  const canSave = allNumbers && grams > 0 && name.trim().length >= 2;

  async function save() {
    setBusy(true);
    setError(null);
    try {
      await api(`/api/foods/label/${scan.id}/save`, {
        json: {
          name: name.trim(),
          per100g: values,
          servingSizeG: servingG,
          servingLabel: scan.servingLabel ?? undefined,
          quantity: servings,
          unit: "serving",
          grams,
          mealType,
          isLiquid: false,
          ...dateBody,
        },
      });
      track("meal_logged", { method: "label" });
      refreshDay();
      showDay(date);
      router.dismissTo("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <Screen
      footer={
        <>
          <View style={styles.total}>
            <View>
              <Text weight={600} size={12} color={c.ink3}>
                Total
              </Text>
              <Text variant="h1" size={26} tabular accessibilityLiveRegion="polite">
                {formatInt(total)}{" "}
                <Text weight={600} size={13} color={c.ink3}>
                  kcal
                </Text>
              </Text>
            </View>
            <Text weight={600} size={13} color={c.ink3} tabular>
              {formatInt(grams)} g
            </Text>
          </View>
          {error && <FieldError>{error}</FieldError>}
          <Button onPress={save} loading={busy} disabled={!canSave}>
            {`Save and add to ${MEAL_LABEL[mealType].toLowerCase()}`}
          </Button>
        </>
      }
    >
      <BackHeader onBack={() => router.replace({ pathname: "/log/label", params })} />
      <View style={{ gap: 4 }}>
        <Text variant="h1" size={26}>
          Check the label values
        </Text>
        <Text color={c.ink2}>We read these per 100 g. Fix anything that doesn&apos;t match the pack.</Text>
      </View>

      <View style={{ gap: 16 }}>
        <View style={{ gap: 6 }}>
          <Text variant="label">Product name</Text>
          <TextInput
            accessibilityLabel="Product name"
            value={name}
            onChangeText={setName}
            placeholder="e.g. Parle-G Gold"
            placeholderTextColor={c.ink3}
            style={styles.input}
          />
        </View>

        {check &&
          (check.ok ? (
            <View style={styles.ok}>
              <BadgeCheck size={16} color={c.protein} />
              <Text weight={600} size={13} color={c.protein}>
                Numbers add up
              </Text>
            </View>
          ) : (
            <View style={styles.warn}>
              <TriangleAlert size={20} color={c.cautionText} />
              <Text size={13} color={c.cautionText} style={{ flex: 1 }}>
                <Text size={13} weight={700} color={c.cautionText}>
                  Please check.
                </Text>{" "}
                Protein, carbs and fat add up to {formatInt(check.fromMacros)} kcal, but energy says{" "}
                {formatInt(values.kcal)} kcal.
              </Text>
            </View>
          ))}

        <View style={styles.grid}>
          <View style={styles.cell}>
            <NumberField label="Energy" unit="kcal" value={kcal} onValueChange={setKcal} />
          </View>
          <View style={styles.cell}>
            <NumberField label="Protein" unit="g" value={protein} onValueChange={setProtein} />
          </View>
          <View style={styles.cell}>
            <NumberField label="Carbs" unit="g" value={carbs} onValueChange={setCarbs} />
          </View>
          <View style={styles.cell}>
            <NumberField label="Fat" unit="g" value={fat} onValueChange={setFat} />
          </View>
        </View>

        <Card>
          <NumberField
            label="Serving size"
            unit="g"
            value={serving}
            onValueChange={setServing}
            hint={scan.servingLabel ? `Label says: ${scan.servingLabel}` : undefined}
          />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text weight={600}>Servings</Text>
            <Stepper label="Servings" value={servings} step={0.5} min={0.5} max={maxServings} onChange={setServings} />
          </View>
        </Card>

        <MealWhen mealType={mealType} onMealType={setMealType} date={date} onDate={setDate} />
      </View>
    </Screen>
  );
}

const useStyles = makeStyles((c) => ({
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: c.lineStrong,
    borderRadius: radius.input,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans400,
    fontSize: 16,
    color: c.ink,
  },
  ok: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: c.proteinSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  warn: { flexDirection: "row", gap: 10, borderRadius: radius.card, backgroundColor: c.cautionSoft, padding: 12 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cell: { width: "47%", flexGrow: 1 },
  total: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderRadius: radius.card,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
}));
