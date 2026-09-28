import { useMutation, useQuery } from "@tanstack/react-query";
import { CircleCheck, Droplet, GlassWater, Undo2 } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Card, FieldError, Text } from "@/components/ui";
import { Line } from "@/components/skeletons";
import { api } from "@/lib/api";
import { waterQuery } from "@/lib/queries";
import { queryClient } from "@/lib/query";
import { syncWaterReminders } from "@/lib/reminders";
import { colors, radius } from "@/lib/theme";
import type { WaterDay } from "@/lib/types";

const L = (ml: number) => (Math.round(ml / 100) / 10).toFixed(1);

/** Today's water: bar vs the personal target (with the reason), + glass / + bottle, undo last. */
export function WaterCard() {
  const water = useQuery(waterQuery);
  const add = useMutation({
    mutationFn: (ml: number) => api<WaterDay>("/api/water", { json: { ml } }),
    onSuccess: (day) => queryClient.setQueryData(waterQuery.queryKey, day),
  });
  const undo = useMutation({
    mutationFn: (id: string) => api(`/api/water/${id}`, { method: "DELETE" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: waterQuery.queryKey }),
  });

  // Keep the phone's water reminders in step: none left today once the target is reached.
  const d = water.data;
  useEffect(() => {
    if (d) syncWaterReminders({ enabled: d.remind, leftMl: d.targetMl - d.consumedMl }).catch(() => {});
  }, [d]);

  if (water.isPending) {
    return (
      <Card>
        <Line width="35%" height={16} tone="card" />
        <Line height={10} tone="card" />
        <Line width="80%" height={12} tone="card" />
      </Card>
    );
  }
  if (!d) return null;

  const pct = Math.min(100, (d.consumedMl / d.targetMl) * 100);
  const reached = d.consumedMl >= d.targetMl;
  const last = d.logs.at(-1);
  const busy = add.isPending || undo.isPending;

  return (
    <Card accessibilityLabel={`Water: ${L(d.consumedMl)} of ${L(d.targetMl)} litres`}>
      <View style={styles.head}>
        <View style={styles.icon}>
          <Droplet size={18} color={colors.water} fill={colors.water} />
        </View>
        <View style={{ flex: 1 }}>
          <Text weight={600}>Water</Text>
          <Text size={13} color={colors.ink3} tabular>
            {d.trainingDay ? "Training day target" : "Today's target"}
          </Text>
        </View>
        <Text variant="h2" size={22} tabular>
          {L(d.consumedMl)}{" "}
          <Text weight={600} size={13} color={colors.ink3}>
            / {L(d.targetMl)} L
          </Text>
        </Text>
      </View>

      <View style={styles.track}>
        <View style={[styles.fill, { width: `${pct}%` }]} />
      </View>

      {reached ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <CircleCheck size={16} color={colors.protein} />
          <Text weight={600} size={13} color={colors.protein}>
            {d.remind ? "Target reached. Reminders are off for the rest of today." : "Target reached. Nice work."}
          </Text>
        </View>
      ) : (
        <Text size={13} color={colors.ink2} tabular>
          {d.reason}. {d.tip}
        </Text>
      )}
      {d.caution && (
        <Text size={12} color={colors.ink3}>
          {d.caution}
        </Text>
      )}

      <View style={{ flexDirection: "row", gap: 8 }}>
        <AddButton label="Glass" sub="250 ml" onPress={() => add.mutate(250)} disabled={busy} />
        <AddButton label="Bottle" sub="500 ml" onPress={() => add.mutate(500)} disabled={busy} />
        {last && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Undo last ${last.ml} ml`}
            onPress={() => undo.mutate(last.id)}
            disabled={busy}
            style={styles.undo}
          >
            <Undo2 size={18} color={colors.ink2} />
          </Pressable>
        )}
      </View>
      {(add.error || undo.error) && (
        <FieldError>{(add.error ?? undo.error)?.message ?? "Couldn't save. Try again."}</FieldError>
      )}
    </Card>
  );
}

function AddButton({ label, sub, onPress, disabled }: { label: string; sub: string; onPress: () => void; disabled: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Add a ${label.toLowerCase()}, ${sub}`}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.add, pressed && { backgroundColor: colors.waterSoft }, disabled && { opacity: 0.6 }]}
    >
      <GlassWater size={18} color={colors.water} />
      <Text weight={600} size={14} color={colors.water}>
        + {label}
      </Text>
      <Text weight={500} size={12} color={colors.ink3}>
        {sub}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", gap: 12 },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: colors.waterSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  track: { height: 10, borderRadius: 5, backgroundColor: colors.track, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 5, backgroundColor: colors.water },
  add: {
    flex: 1,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: radius.input,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: colors.surface,
  },
  undo: {
    width: 48,
    minHeight: 48,
    borderRadius: radius.input,
    backgroundColor: colors.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
});
