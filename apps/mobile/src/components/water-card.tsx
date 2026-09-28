import { useMutation, useQuery } from "@tanstack/react-query";
import { Info, Undo2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { FieldError, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { waterQuery } from "@/lib/queries";
import { queryClient } from "@/lib/query";
import { syncWaterReminders } from "@/lib/reminders";
import { colors } from "@/lib/theme";
import type { WaterDay } from "@/lib/types";

const L = (ml: number) => (Math.round(ml / 100) / 10).toFixed(1);

/** Today's water plus add / undo, and keeps the phone's reminders in step with progress. */
export function useWater() {
  const water = useQuery(waterQuery);
  const add = useMutation({
    mutationFn: (ml: number) => api<WaterDay>("/api/water", { json: { ml } }),
    onSuccess: (day) => queryClient.setQueryData(waterQuery.queryKey, day),
  });
  const undo = useMutation({
    mutationFn: (id: string) => api(`/api/water/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: waterQuery.queryKey }),
  });

  // No reminders left today once the target is reached.
  const d = water.data;
  useEffect(() => {
    if (d) syncWaterReminders({ enabled: d.remind, leftMl: d.targetMl - d.consumedMl }).catch(() => {});
  }, [d]);

  return { water, add, undo };
}

/** Fourth bar under Protein / Carbs / Fat in the Today card: "1.0 / 3.5 L". */
export function WaterBar({ day }: { day: WaterDay | undefined }) {
  const pct = day ? Math.min(100, (day.consumedMl / day.targetMl) * 100) : 0;
  return (
    <View
      style={{ gap: 6 }}
      accessible
      accessibilityLabel={day ? `Water: ${L(day.consumedMl)} of ${L(day.targetMl)} litres` : "Water"}
    >
      <View style={styles.row}>
        <Text weight={600} size={13}>
          Water
        </Text>
        <Text weight={600} size={13} color={colors.ink2} tabular>
          {day ? `${L(day.consumedMl)} / ${L(day.targetMl)} L` : "—"}
        </Text>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>
    </View>
  );
}

/**
 * Compact add row at the foot of the Today card: +250 ml, +500 ml, undo, and an info toggle
 * that shows how the target was worked out.
 */
export function WaterQuickAdd({ water }: { water: ReturnType<typeof useWater> }) {
  const [why, setWhy] = useState(false);
  const d = water.water.data;
  if (!d) return null;
  const busy = water.add.isPending || water.undo.isPending;
  const last = d.logs.at(-1);
  const reached = d.consumedMl >= d.targetMl;
  const error = water.add.error ?? water.undo.error;

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.quick}>
        <Text
          weight={600}
          size={13}
          color={reached ? colors.protein : colors.water}
          style={{ flex: 1 }}
          numberOfLines={1}
        >
          {reached ? "Target reached" : `${L(d.targetMl - d.consumedMl)} L left`}
        </Text>
        <Chip label="+250 ml" a11y="Add a glass, 250 ml" onPress={() => water.add.mutate(250)} disabled={busy} />
        <Chip label="+500 ml" a11y="Add a bottle, 500 ml" onPress={() => water.add.mutate(500)} disabled={busy} />
        {last && (
          <IconButton label={`Undo last ${last.ml} ml`} onPress={() => water.undo.mutate(last.id)} disabled={busy}>
            <Undo2 size={16} color={colors.ink2} />
          </IconButton>
        )}
        <IconButton
          label={why ? "Hide how the water target works" : "How the water target works"}
          onPress={() => setWhy((w) => !w)}
        >
          <Info size={16} color={why ? colors.water : colors.ink3} />
        </IconButton>
      </View>
      {why && (
        <Text size={12} color={colors.ink2} tabular>
          {d.reason}. {d.tip}
          {d.caution ? ` ${d.caution}` : ""}
        </Text>
      )}
      {error && <FieldError>{error.message || "Couldn't save. Try again."}</FieldError>}
    </View>
  );
}

function Chip({
  label,
  a11y,
  onPress,
  disabled,
}: {
  label: string;
  a11y: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, pressed && { backgroundColor: colors.water }, disabled && { opacity: 0.6 }]}
    >
      {({ pressed }) => (
        <Text weight={600} size={13} color={pressed ? colors.white : colors.water} tabular>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function IconButton({
  label,
  onPress,
  disabled,
  children,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={styles.icon}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.track, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: colors.water },
  quick: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: {
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 16,
    backgroundColor: colors.waterSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
});
