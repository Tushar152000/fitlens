import { Pencil, X } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { formatInt, formatPortion, sentenceCase, unitStep } from "@/lib/format";
import { colors, fonts, radius } from "@/lib/theme";
import { Stepper } from "./stepper";
import { Text } from "./text";

export const LOW_CONFIDENCE = 0.6;

export interface EditableItem {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  kcal: number;
  confidence?: number | null;
  approximate?: boolean;
  isLiquid?: boolean;
}

/** One detected item: name, portion, low-confidence flag, quantity stepper and kcal. */
export function MealItemEditor({
  item,
  onQuantityChange,
  onAmountChange,
  onRemove,
}: {
  item: EditableItem;
  onQuantityChange: (quantity: number) => void;
  /** Exact amount in g (ml for drinks). When set, tapping the portion line edits it. */
  onAmountChange?: (grams: number) => void;
  onRemove?: () => void;
}) {
  const unsure = item.confidence != null && item.confidence < LOW_CONFIDENCE;
  const measure = item.isLiquid ? "ml" : "g";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const portion = `${formatPortion(item.quantity, item.unit, item.grams, item.isLiquid)}${item.approximate ? " · estimated" : ""}`;

  function commit() {
    const n = Number(draft);
    if (Number.isFinite(n) && n > 0 && n <= 3000) onAmountChange?.(n);
    setEditing(false);
  }

  return (
    <View style={[styles.card, unsure && styles.unsure]}>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0, gap: 2 }}>
          <Text weight={600} size={16}>
            {sentenceCase(item.name)}
          </Text>
          {editing ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
              <View style={styles.amountBox}>
                <TextInput
                  accessibilityLabel={`Amount in ${measure}`}
                  autoFocus
                  keyboardType="decimal-pad"
                  value={draft}
                  onChangeText={(v) => setDraft(v.replace(",", "."))}
                  onBlur={commit}
                  onSubmitEditing={commit}
                  style={styles.amountInput}
                />
                <Text weight={600} size={13} color={colors.ink3}>
                  {measure}
                </Text>
              </View>
              <Pressable onPress={commit} style={{ minHeight: 44, justifyContent: "center", paddingHorizontal: 8 }}>
                <Text weight={600} size={13} color={colors.brand}>
                  Done
                </Text>
              </Pressable>
            </View>
          ) : onAmountChange ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Change amount, now ${Math.round(item.grams)} ${measure}`}
              onPress={() => {
                setDraft(String(Math.round(item.grams)));
                setEditing(true);
              }}
              style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 32, alignSelf: "flex-start" }}
            >
              <Text weight={500} size={13} color={colors.ink3} tabular>
                {portion}
              </Text>
              <Pencil size={14} color={colors.ink3} />
            </Pressable>
          ) : (
            <Text weight={500} size={13} color={colors.ink3} tabular>
              {portion}
            </Text>
          )}
          {unsure && (
            <View style={styles.tag}>
              <Text weight={600} size={12} color={colors.cautionText}>
                Not sure — check this
              </Text>
            </View>
          )}
        </View>
        {onRemove && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${item.name}`}
            onPress={onRemove}
            style={{ width: 44, height: 44, marginTop: -8, marginRight: -8, alignItems: "center", justifyContent: "center" }}
          >
            <X size={20} color={colors.ink3} />
          </Pressable>
        )}
      </View>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <Stepper label={`${item.name} quantity`} value={item.quantity} step={unitStep(item.unit)} onChange={onQuantityChange} />
        <Text weight={700} size={16} tabular>
          {formatInt(item.kcal)}{" "}
          <Text weight={600} size={13} color={colors.ink3}>
            kcal
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: 12, borderRadius: radius.card, backgroundColor: colors.surface, padding: 16 },
  unsure: { borderWidth: 1.5, borderColor: colors.caution, padding: 14.5 },
  tag: {
    marginTop: 4,
    alignSelf: "flex-start",
    borderRadius: 999,
    backgroundColor: colors.cautionSoft,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  amountBox: {
    height: 44,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: colors.ink,
    borderRadius: radius.input,
    paddingHorizontal: 12,
  },
  amountInput: { width: 64, fontFamily: fonts.sans600, fontSize: 15, color: colors.ink, padding: 0 },
});
