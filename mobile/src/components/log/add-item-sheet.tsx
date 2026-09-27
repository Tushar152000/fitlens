import { Search, Sparkles } from "lucide-react-native";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from "react-native";
import { Sheet } from "@/components/sheet";
import { Button, FieldError, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { formatInt, sentenceCase, type MealType } from "@/lib/format";
import { rowFromFood, type Row } from "@/lib/meal-rows";
import { colors, fonts, radius } from "@/lib/theme";

export interface FoodHit {
  id: string;
  name: string;
  per100g: { kcal: number; protein: number; carbs: number; fat: number };
  units: { unit: string; grams: number }[];
  isLiquid: boolean;
}

interface ParsedItem {
  foodId: string | null;
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  approximate: boolean;
  aiConfidence: number;
  isLiquid: boolean;
}

/** Search the food list, or describe an item in words ("2 sachets sugar") and let the AI price it. */
export function AddItemSheet({
  open,
  mealType,
  onClose,
  onAdd,
}: {
  open: boolean;
  mealType: MealType;
  onClose: () => void;
  onAdd: (rows: Row[]) => void;
}) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<FoodHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<FoodHit | null>(null);
  const [describing, setDescribing] = useState(false);
  const [describeError, setDescribeError] = useState<string | null>(null);
  const text = q.trim();

  useEffect(() => {
    if (!open) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await api<{ foods: FoodHit[] }>(`/api/foods?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
        setHits(res.foods);
      } catch {
        // aborted or offline
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, open]);

  async function describe() {
    setDescribing(true);
    setDescribeError(null);
    try {
      const { items } = await api<{ items: ParsedItem[] }>("/api/meals/parse-items", { json: { text, mealType } });
      if (!items.length) {
        setDescribeError("That doesn't sound like food or a drink. Try wording it differently.");
        return;
      }
      onAdd(
        items.map((i, n) => ({
          key: `ai-${Date.now()}-${n}`,
          foodId: i.foodId,
          name: i.name,
          quantity: i.quantity,
          unit: i.unit,
          grams: i.grams,
          kcal: i.kcal,
          proteinG: i.proteinG,
          carbsG: i.carbsG,
          fatG: i.fatG,
          confidence: i.aiConfidence,
          approximate: i.approximate,
          isLiquid: i.isLiquid,
        })),
      );
      setQ("");
    } catch (e) {
      setDescribeError(e instanceof Error ? e.message : "Couldn't add that. Try again.");
    } finally {
      setDescribing(false);
    }
  }

  const close = () => {
    setPicked(null);
    setQ("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={close} title={picked ? sentenceCase(picked.name) : "Add an item"}>
      {picked ? (
        <View style={{ gap: 10 }}>
          <Text variant="label">Pick a portion</Text>
          {picked.units.map((u) => {
            const row = rowFromFood(picked, u);
            return (
              <Pressable
                key={u.unit}
                accessibilityRole="button"
                onPress={() => {
                  onAdd([row]);
                  setPicked(null);
                  setQ("");
                }}
                style={styles.portion}
              >
                <Text weight={600}>
                  1 {u.unit}{" "}
                  <Text weight={500} color={colors.ink3}>
                    · {formatInt(u.grams)} {picked.isLiquid ? "ml" : "g"}
                  </Text>
                </Text>
                <Text weight={700} tabular>
                  {formatInt(row.kcal)} kcal
                </Text>
              </Pressable>
            );
          })}
          <Button variant="secondary" onPress={() => setPicked(null)}>
            Back to search
          </Button>
        </View>
      ) : (
        <View style={{ gap: 12 }}>
          <View style={styles.search}>
            <Search size={20} color={colors.ink3} />
            <TextInput
              accessibilityLabel="Search foods"
              value={q}
              onChangeText={(v) => {
                setQ(v);
                setDescribeError(null);
              }}
              placeholder="Search sugar, roti, dal…"
              placeholderTextColor="rgba(107,110,118,0.6)"
              autoCorrect={false}
              style={styles.searchInput}
            />
            {loading && <ActivityIndicator size="small" color={colors.ink3} />}
          </View>
          <View>
            {hits.map((f) => (
              <Pressable key={f.id} accessibilityRole="button" onPress={() => setPicked(f)} style={styles.hit}>
                <Text weight={600} style={{ flex: 1 }}>
                  {sentenceCase(f.name)}
                </Text>
                <Text size={13} color={colors.ink3} tabular>
                  {formatInt(f.per100g.kcal)} kcal / 100 g
                </Text>
              </Pressable>
            ))}
            {!loading && hits.length === 0 && (
              <Text size={13} color={colors.ink3} center style={{ paddingVertical: 16 }}>
                No match in our food list. Describe it below instead.
              </Text>
            )}
          </View>
          {text.length >= 2 ? (
            <Button
              variant={hits.length === 0 && !loading ? "primary" : "secondary"}
              icon={Sparkles}
              onPress={describe}
              loading={describing}
            >
              {`Add “${text}”`}
            </Button>
          ) : (
            <Text size={13} color={colors.ink3}>
              Or describe it, like “2 sachets sugar” or “half cup milk”.
            </Text>
          )}
          {describeError && <FieldError>{describeError}</FieldError>}
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  portion: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  search: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontFamily: fonts.sans400, fontSize: 16, color: colors.ink, padding: 0 },
  hit: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    paddingVertical: 8,
  },
});
