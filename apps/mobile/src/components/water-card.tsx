import { useMutation, useQuery } from "@tanstack/react-query";
import { Info, Redo2, Undo2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { FieldError, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { waterQuery } from "@/lib/queries";
import { queryClient } from "@/lib/query";
import { syncWaterReminders } from "@/lib/reminders";
import { makeStyles, useColors } from "@/lib/theme";
import type { WaterDay } from "@/lib/types";

const L = (ml: number) => (Math.round(ml / 100) / 10).toFixed(1);

/** Today's water plus add / undo / redo, and keeps the phone's reminders in step with progress. */
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
  const c = useColors();
  const styles = useStyles();
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
        <Text weight={600} size={13} color={c.ink2} tabular>
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
 * Compact add row at the foot of the Today card: +250 ml, +500 ml, undo, redo, and an info toggle
 * that shows how the target was worked out.
 */
export function WaterQuickAdd({ water }: { water: ReturnType<typeof useWater> }) {
  const c = useColors();
  const styles = useStyles();
  const [why, setWhy] = useState(false);
  // Amounts taken off with Undo, newest last; Redo adds them back. A new add starts fresh.
  const [undone, setUndone] = useState<number[]>([]);
  const d = water.water.data;
  if (!d) return null;
  const busy = water.add.isPending || water.undo.isPending;
  const last = d.logs.at(-1);
  const reached = d.consumedMl >= d.targetMl;
  const error = water.add.error ?? water.undo.error;
  const redoMl = undone.at(-1);

  const add = (ml: number) => water.add.mutate(ml, { onSuccess: () => setUndone([]) });
  const undo = () => {
    if (!last) return;
    const ml = last.ml;
    water.undo.mutate(last.id, { onSuccess: () => setUndone((u) => [...u, ml]) });
  };
  const redo = () => {
    if (redoMl == null) return;
    water.add.mutate(redoMl, { onSuccess: () => setUndone((u) => u.slice(0, -1)) });
  };

  return (
    <View style={{ gap: 8 }}>
      <View style={styles.quick}>
        <Text weight={600} size={13} color={reached ? c.protein : c.water} style={{ flex: 1 }} numberOfLines={1}>
          {reached ? "Target reached" : `${L(d.targetMl - d.consumedMl)} L left`}
        </Text>
        <Chip label="+250 ml" a11y="Add a glass, 250 ml" onPress={() => add(250)} disabled={busy} />
        <Chip label="+500 ml" a11y="Add a bottle, 500 ml" onPress={() => add(500)} disabled={busy} />
        {last && (
          <IconButton label={`Undo last ${last.ml} ml`} onPress={undo} disabled={busy}>
            <Undo2 size={16} color={c.ink2} />
          </IconButton>
        )}
        {redoMl != null && (
          <IconButton label={`Redo ${redoMl} ml`} onPress={redo} disabled={busy}>
            <Redo2 size={16} color={c.ink2} />
          </IconButton>
        )}
        <IconButton
          label={why ? "Hide how the water target works" : "How the water target works"}
          onPress={() => setWhy((w) => !w)}
        >
          <Info size={16} color={why ? c.water : c.ink3} />
        </IconButton>
      </View>
      {why && (
        <Text size={12} color={c.ink2} tabular>
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
  const c = useColors();
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={a11y}
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      style={({ pressed }) => [styles.chip, pressed && { backgroundColor: c.water }, disabled && { opacity: 0.6 }]}
    >
      {({ pressed }) => (
        <Text weight={600} size={13} color={pressed ? c.surface : c.water} tabular>
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
  const styles = useStyles();
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

const useStyles = makeStyles((c) => ({
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  track: { height: 8, borderRadius: 4, backgroundColor: c.track, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 4, backgroundColor: c.water },
  quick: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: {
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 16,
    backgroundColor: c.waterSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  icon: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
}));
