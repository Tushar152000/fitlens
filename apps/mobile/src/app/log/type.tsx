import { useQuery } from "@tanstack/react-query";
import type { SavedMealDto, UsualDto } from "@fitr8/contracts";
import { router } from "expo-router";
import { Bookmark, ChevronRight, Info, Pencil, Plus, Repeat, X } from "lucide-react-native";
import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MealWhen } from "@/components/log/meal-when";
import { ModeTabs } from "@/components/log/mode-tabs";
import { Button, FieldError, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { track } from "@/lib/analytics";
import { formatInt, MEAL_LABEL, mealTitle } from "@/lib/format";
import { useMealChoice } from "@/lib/meal-param";
import { queryClient, refreshDay } from "@/lib/query";
import { savedMealsQuery } from "@/lib/queries";
import { showDay } from "@/lib/view-day";
import { colors, fonts, radius } from "@/lib/theme";

export type Usual = UsualDto;

/** Screen 7b: type what you ate, or relog a usual with one tap. Typing never uses a photo scan. */
export default function TypeMealScreen() {
  const { mealType, setMealType, date, setDate, dateBody, params } = useMealChoice();
  const insets = useSafeAreaInsets();
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<string | null>(null); // "text", a usual's mealId or a saved meal's id
  const [error, setError] = useState<string | null>(null);
  const usuals = useQuery({
    queryKey: ["usuals"],
    queryFn: () => api<{ usuals: Usual[] }>("/api/meals/usuals").then((r) => r.usuals),
  });
  const saved = useQuery(savedMealsQuery);

  async function submit() {
    const value = text.trim();
    setError(null);
    if (!mealType) return setMissing(true);
    if (value.length < 2) return setError("Tell us what you ate, e.g. 2 roti and 1 katori dal");
    setBusy("text");
    try {
      const log = await api<{ id: string }>("/api/meals", {
        json: { source: "TEXT", mealType, text: value, ...dateBody },
      });
      router.replace(`/log/${log.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that. Try again.");
      setBusy(null);
    }
  }

  async function relog(u: Usual) {
    if (!mealType) return setMissing(true);
    setBusy(u.mealId);
    setError(null);
    try {
      await api("/api/meals/relog", { json: { mealId: u.mealId, mealType, ...dateBody } });
      track("meal_logged", { method: "usual" });
      refreshDay();
      showDay(date);
      router.dismissTo("/today");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add that. Try again.");
      setBusy(null);
    }
  }

  /** One tap: the picked meal, else the slot the user saved it for; never a guess from the clock. */
  async function logSaved(m: SavedMealDto) {
    const slot = mealType ?? m.mealType;
    if (!slot) return setMissing(true);
    setBusy(m.id);
    setError(null);
    try {
      await api(`/api/saved-meals/${m.id}/log`, { json: { mealType: slot, ...dateBody } });
      track("meal_logged", { method: "saved" });
      refreshDay();
      queryClient.invalidateQueries({ queryKey: savedMealsQuery.queryKey });
      showDay(date);
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
        </View>

        <Text variant="h1">What did you eat?</Text>

        <MealWhen
          mealType={mealType}
          onMealType={(m) => {
            setMealType(m);
            setMissing(false);
          }}
          date={date}
          onDate={setDate}
          missing={missing}
        />

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

        {saved.isSuccess && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <View style={styles.sectionHead}>
              <Text variant="h2">Saved meals</Text>
              {saved.data.length > 0 && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="New saved meal"
                  onPress={() => router.push({ pathname: "/log/saved/[id]", params: { id: "new", ...params } })}
                  style={styles.link}
                  hitSlop={6}
                >
                  <Plus size={16} color={colors.brand} />
                  <Text weight={600} size={14} color={colors.brand}>
                    New
                  </Text>
                </Pressable>
              )}
            </View>
            {saved.data.length === 0 ? (
              <Button
                variant="dashed"
                icon={Bookmark}
                onPress={() => router.push({ pathname: "/log/saved/[id]", params: { id: "new", ...params } })}
              >
                Save a meal you eat often
              </Button>
            ) : (
              <>
                <Text size={13} color={colors.ink3}>
                  {mealType
                    ? `One tap adds it to ${MEAL_LABEL[mealType].toLowerCase()}. No AI scan used.`
                    : "One tap adds it to its usual meal, or pick one above. No AI scan used."}
                </Text>
                {saved.data.map((m) => (
                  <View key={m.id} style={[styles.usual, busy !== null && { opacity: 0.6 }]}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Add ${m.name}`}
                      onPress={() => logSaved(m)}
                      disabled={busy !== null}
                      style={styles.usualMain}
                    >
                      <View style={[styles.usualIcon, { backgroundColor: colors.proteinSoft }]}>
                        <Bookmark size={20} color={colors.protein} />
                      </View>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text weight={600} numberOfLines={1}>
                          {m.name}
                        </Text>
                        <Text size={13} color={colors.ink3} tabular numberOfLines={1}>
                          {formatInt(m.kcal)} kcal · {m.proteinG} g protein · {m.items.length}{" "}
                          {m.items.length === 1 ? "item" : "items"}
                          {!mealType && m.mealType ? ` · ${MEAL_LABEL[m.mealType]}` : ""}
                        </Text>
                      </View>
                      <Text weight={600} size={13} color={colors.brand}>
                        {busy === m.id ? "Adding…" : "Add"}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Edit ${m.name}`}
                      onPress={() => router.push({ pathname: "/log/saved/[id]", params: { id: m.id } })}
                      disabled={busy !== null}
                      style={styles.edit}
                    >
                      <Pencil size={18} color={colors.ink3} />
                    </Pressable>
                  </View>
                ))}
              </>
            )}
          </View>
        )}

        {(usuals.data?.length ?? 0) > 0 && (
          <View style={{ gap: 8, marginTop: 8 }}>
            <Text variant="h2">Your usuals</Text>
            <Text size={13} color={colors.ink3}>
              {mealType
                ? `One tap adds it to ${MEAL_LABEL[mealType].toLowerCase()}. No AI scan used.`
                : "Pick a meal above, then one tap adds it. No AI scan used."}
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
                    {formatInt(u.kcal)} kcal · {u.proteinG} g protein{u.count > 1 ? ` · logged ${u.count}×` : ""}
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
        <ModeTabs current="type" params={params} tone="light" />
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
  usualMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minHeight: 40 },
  edit: { width: 44, height: 44, marginRight: -8, alignItems: "center", justifyContent: "center" },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  link: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 4 },
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
