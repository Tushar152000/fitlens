import { Image } from "expo-image";
import { ChevronRight, NotebookPen } from "lucide-react-native";
import { Pressable, StyleSheet, View } from "react-native";
import { formatInt } from "@/lib/format";
import { colors, radius } from "@/lib/theme";
import type { MealStatus } from "@/lib/types";
import { Text } from "./text";

const STATUS_TEXT: Partial<Record<MealStatus, string>> = {
  PENDING: "Reading your plate…",
  ANALYZING: "Reading your plate…",
  READY: "Tap to confirm",
  FAILED: "Couldn't read this one",
};

/** 48 px thumb, "Lunch · 13:15" meta, title, kcal right-aligned. */
export function MealRow({
  onPress,
  photoUrl,
  meta,
  title,
  kcal,
  status = "CONFIRMED",
}: {
  onPress: () => void;
  photoUrl?: string | null;
  meta: string;
  title: string;
  kcal: number;
  status?: MealStatus;
}) {
  const note = STATUS_TEXT[status];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.8 }]}
    >
      <View style={styles.thumb}>
        {photoUrl ? (
          <Image source={{ uri: photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" />
        ) : (
          <NotebookPen size={20} color={colors.ink2} strokeWidth={2} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text weight={600} size={12} color={colors.ink3}>
          {meta}
        </Text>
        <Text weight={600} numberOfLines={1}>
          {title}
        </Text>
        {note && (
          <Text weight={600} size={12} color={status === "READY" ? colors.brand : colors.ink3}>
            {note}
          </Text>
        )}
      </View>
      {status === "CONFIRMED" ? (
        <Text weight={700} tabular>
          {formatInt(kcal)}{" "}
          <Text weight={600} size={12} color={colors.ink3}>
            kcal
          </Text>
        </Text>
      ) : (
        <ChevronRight size={20} color={colors.ink3} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
});
