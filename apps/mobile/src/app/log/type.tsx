import { useQuery } from "@tanstack/react-query";
import type { UsualDto } from "@fitr8/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronRight, Info, Repeat, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModeTabs } from "@/components/log/mode-tabs";
import { Button, Chip, FieldError, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { formatInt, MEAL_LABEL, MEAL_TYPES, mealTitle, type MealType } from "@/lib/format";
import { mealFromParam } from "@/lib/meal-param";
import { refreshDay } from "@/lib/query";
import { colors, fonts, radius } from "@/lib/theme";

export type Usual = UsualDto;

/** Screen 7b: type what you ate, or relog a usual with one tap. Typing never uses a photo scan. */
export default function TypeMealScreen() {
  const params = useLocalSearchParams<{ meal?: string }>();
  const insets = useSafeAreaInsets();
  const [mealType, setMealType] = useState<MealType>(() => mealFromParam(params.meal));
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "text" or a usual's mealId
  const [error, setError] = useState<string | null>(null);
  const usuals = useQuery({
    queryKey: ["usuals"],
    queryFn: () => api<{ usuals: Usual[] }>("/api/meals/usuals").then((r) => r.usuals),
  });

  async function submit() {
    const value = text.trim();
    setError(null);
    if (value.length < 2) return setError("Tell us what you ate, e.g. 2 roti and 1 katori dal");
    setBusy("text");
    try {
      const log = await api<{ id: string }>("/api/meals", { json: { source: "TEXT", mealType, text: value } });
      router.replace(`/log/${log.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that. Try again.");
      setBusy(null);
    }
  }

  async function relog(u: Usual) {
    setBusy(u.mealId);
    setError(null);
    try {
      await api("/api/meals/relog", { json: { mealId: u.mealId, mealType } });
      track("meal_logged", { method: "usual" });
      refreshDay();
      router.dismissTo("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that. Try again.");
      setBusy(null);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 24, gap: 16 }}
      >
        <View style={styles.top}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={() => router.back()}
            style={styles.close}
          >
            <X size={26} color={colors.ink} />
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
            {MEAL_TYPES.map((t) => (
              <Chip key={t} selected={t === mealType} onPress={() => setMealType(t)}>
                {MEAL_LABEL[t]}
              </Chip>
            ))}
          </ScrollView>
        </View>

        <Text variant="h1">What did you eat?</Text>

        <View style={{ gap: 8 }}>
          <TextInput
            accessibilityLabel="What did you eat?"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={500}
            placeholder="2 roti, 1 katori dal, half katori bhindi, 1 cup chai with 1 sachet sugar"
            placeholderTextColor="rgba(107,110,118,0.6)"
            style={styles.textarea}
            textAlignVertical="top"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Info size={16} color={colors.ink3} style={{ marginTop: 2 }} />
            <Text size={13} color={colors.ink3} style={{ flex: 1 }}>
              Add amounts for better numbers: pieces, katori, cups, grams or ml. Typing never uses a photo scan.
            </Text>
          </View>
          {error && <FieldError>{error}</FieldError>}
        </View>

        {(usuals.data?.length ?? 0) > 0 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text variant="h2">Your usuals</Text>
            <Text size={13} color={colors.ink3}>
              One tap adds it to {MEAL_LABEL[mealType].toLowerCase()}. No AI scan used.
            </Text>
            {usuals.data!.map((u) => (
              <Pressable
                key={u.mealId}
                accessibilityRole="button"
                onPress={() => relog(u)}
                disabled={busy !== null}
                style={[styles.usual, busy !== null && { opacity: 0.6 }]}
              >
                <View style={styles.usualIcon}>
                  <Repeat size={20} color={colors.ink2} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text weight={600} numberOfLines={1}>
                    {mealTitle(u.names, "Meal")}
                  </Text>
                  <Text size={13} color={colors.ink3} tabular>
                    {formatInt(u.kcal)} kcal · P {u.proteinG} g{u.count > 1 ? ` · logged ${u.count}×` : ""}
                  </Text>
                </View>
                <Text weight={600} size={13} color={colors.brand}>
                  {busy === u.mealId ? "Adding…" : "Add"}
                </Text>
                <ChevronRight size={20} color={colors.ink3} />
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
        <Button onPress={submit} loading={busy === "text"} disabled={busy !== null && busy !== "text"}>
          Get calories
        </Button>
        <ModeTabs current="type" mealType={mealType} tone="light" />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", alignItems: "center", gap: 8 },
  close: { width: 44, height: 44, marginLeft: -8, alignItems: "center", justifyContent: "center" },
  textarea: {
    minHeight: 144,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    padding: 16,
    fontFamily: fonts.sans400,
    fontSize: 17,
    lineHeight: 23,
    color: colors.ink,
  },
  usual: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  usualIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.sunken,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 16,
    backgroundColor: colors.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});
