import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { router, useLocalSearchParams } from "expo-router";
import { ChevronLeft, NotebookPen, Plus, Sparkles, Trash2 } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AddItemSheet } from "@/components/log/add-item-sheet";
import { AiLimitSheet, type ScanUsage } from "@/components/log/ai-limit-sheet";
import { Analysing, Failed, Found } from "@/components/log/meal-states";
import { QueryError } from "@/components/query-error";
import { Button, Card, FieldError, MealItemEditor, Skeleton, Switch, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { confirmAction } from "@/lib/confirm";
import { formatInt, MEAL_LABEL } from "@/lib/format";
import { fromItems, scaleRow, setRowGrams, toConfirmPayload, totals, type Row } from "@/lib/meal-rows";
import { refreshDay } from "@/lib/query";
import { colors, fonts, radius } from "@/lib/theme";
import type { Meal } from "@/lib/types";

type MealDto = Meal & { aiRaw: { hiddenFatLikely?: boolean } | null };

const POLL_MS = 1000;
const POLL_GIVE_UP_MS = 60_000;

/** Screens 8 / 9 / 9b: analysing → review and confirm → or couldn't read. Also edits a saved meal. */
export default function ConfirmMealScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [slow, setSlow] = useState(false);
  const [pollKey, setPollKey] = useState(0); // bumps on re-check to restart the give-up timer
  // This screen watched the analysis finish, so show "Found N items" first.
  const [sawAnalysing, setSawAnalysing] = useState(false);
  const meal = useQuery({
    queryKey: ["meal", id],
    queryFn: () => api<MealDto>(`/api/meals/${id}`),
    // Poll while the worker analyses (design: every 1 s, give up after 60 s).
    refetchInterval: (q) => {
      const s = q.state.data?.status;
      return (s === "PENDING" || s === "ANALYZING") && !slow ? POLL_MS : false;
    },
    staleTime: 0,
  });
  const status = meal.data?.status;
  const analysing = status === "PENDING" || status === "ANALYZING";
  if (analysing && !sawAnalysing) setSawAnalysing(true);

  useEffect(() => {
    if (!analysing) return;
    const t = setTimeout(() => setSlow(true), POLL_GIVE_UP_MS);
    return () => clearTimeout(t);
  }, [analysing, pollKey]);

  if (meal.isPending) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ground, padding: 20, paddingTop: 80, gap: 12 }}>
        <Skeleton height={32} width="60%" />
        <Skeleton height={120} />
        <Skeleton height={120} />
      </View>
    );
  }
  if (meal.isError) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.ground, padding: 20, paddingTop: 80 }}>
        <QueryError error={meal.error} onRetry={() => meal.refetch()} />
      </View>
    );
  }
  return (
    <Editor
      key={analysing ? "wait" : "ready"}
      meal={meal.data}
      slow={slow}
      live={sawAnalysing}
      onRechecked={() => {
        setSlow(false);
        setPollKey((k) => k + 1);
        meal.refetch();
      }}
    />
  );
}

function Editor({
  meal,
  slow,
  live,
  onRechecked,
}: {
  meal: MealDto;
  slow: boolean;
  /** This screen watched the analysis finish (so show "Found N items" first). */
  live: boolean;
  onRechecked: () => void;
}) {
  const insets = useSafeAreaInsets();
  const analysing = meal.status === "PENDING" || meal.status === "ANALYZING";
  const saved = meal.status === "CONFIRMED";
  const initial = fromItems(meal.items);
  const [rows, setRows] = useState<Row[]>(initial.rows);
  const [ghee, setGhee] = useState(saved ? initial.ghee : Boolean(meal.aiRaw?.hiddenFatLikely) || initial.ghee);
  const [note, setNote] = useState(meal.note ?? "");
  // Design 8 → 9: after a live analysis, show "Found N items" until the user taps Review.
  const [found, setFound] = useState(live && meal.status === "READY" && initial.rows.length > 0);
  const [saving, setSaving] = useState(false);
  const [rechecking, setRechecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [limit, setLimit] = useState<ScanUsage | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);

  // Ghee/oil only makes sense for cooked food, not a coffee or a shake.
  const gheeRelevant = rows.length === 0 || rows.some((r) => !r.isLiquid);
  const withGhee = ghee && gheeRelevant;
  const sum = totals(rows, withGhee);
  const mealLabel = MEAL_LABEL[meal.mealType].toLowerCase();
  const manual = meal.source === "TEXT" && !meal.inputText;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      await api(`/api/meals/${meal.id}`, { method: "PUT", json: toConfirmPayload(rows, withGhee, note) });
      refreshDay();
      router.dismissTo("/today");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
      setSaving(false);
    }
  }

  /** Run the AI again: with the Details note, or as a plain retry after an error (design 9b). */
  async function recheck(withNote = true) {
    setRechecking(true);
    setError(null);
    const body = withNote && note.trim() ? { note: note.trim() } : {};
    try {
      await api(`/api/meals/${meal.id}/recheck`, { json: body });
      onRechecked();
    } catch (e) {
      if (e instanceof ApiError && e.status === 429 && e.details) {
        setLimit(e.details as ScanUsage);
        setLimitOpen(true);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't re-check. Try again.");
      }
    } finally {
      setRechecking(false);
    }
  }

  async function remove() {
    if (!(await confirmAction("Delete this meal?", "It comes off today's totals.", "Delete"))) return;
    try {
      await api(`/api/meals/${meal.id}`, { method: "DELETE" });
      refreshDay();
      router.dismissTo("/today");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete. Try again.");
    }
  }

  const editing = !analysing && meal.status !== "FAILED" && !found;
  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.ground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ flexGrow: 1, paddingBottom: editing ? 16 : Math.max(16, insets.bottom) }}
      >
        <Header meal={meal} scanning={analysing} top={insets.top} />
        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20, gap: 12 }}>
          {analysing ? (
            <Analysing slow={slow} mealType={meal.mealType} hasPhoto={Boolean(meal.photoUrl)} />
          ) : meal.status === "FAILED" ? (
            <Failed
              mealType={meal.mealType}
              errorText={meal.error}
              onRetry={() => recheck(false)}
              retrying={rechecking}
              error={error}
              onDelete={remove}
            />
          ) : found ? (
            <Found count={rows.length} onReview={() => setFound(false)} />
          ) : (
            <>
              <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
                <Text variant="h1" size={26} style={{ flex: 1 }}>
                  {saved
                    ? `Edit ${mealLabel}`
                    : rows.length === 0
                      ? "Add what you ate"
                      : manual
                        ? `${rows.length} ${rows.length === 1 ? "item" : "items"}`
                        : `We found ${rows.length} ${rows.length === 1 ? "item" : "items"}`}
                </Text>
                <Pressable accessibilityRole="button" onPress={remove} style={styles.delete}>
                  <Trash2 size={16} color={colors.ink3} />
                  <Text weight={600} size={13} color={colors.ink3}>
                    Delete
                  </Text>
                </Pressable>
              </View>
              {meal.aiNotes && !manual && (
                <Text size={13} color={colors.ink3}>
                  {meal.aiNotes}
                </Text>
              )}
              {rows.length > 0 && !manual && (
                <Text size={13} color={colors.ink3}>
                  Check portions — tap − or + to adjust.
                </Text>
              )}

              <View style={{ gap: 10, marginTop: 4 }}>
                {rows.map((row, i) => (
                  <MealItemEditor
                    key={row.key}
                    item={row}
                    onQuantityChange={(q) => setRows((all) => all.map((r, j) => (j === i ? scaleRow(r, q) : r)))}
                    onAmountChange={(g) => setRows((all) => all.map((r, j) => (j === i ? setRowGrams(r, g) : r)))}
                    onRemove={() => setRows((all) => all.filter((_, j) => j !== i))}
                  />
                ))}
                <Button variant="dashed" icon={Plus} onPress={() => setAddOpen(true)}>
                  {rows.length ? "Add a missed item" : "Add an item"}
                </Button>
              </View>

              {gheeRelevant && (
                <Card style={styles.row}>
                  <View style={{ flex: 1 }}>
                    <Text weight={600}>Cooked with ghee or oil</Text>
                    <Text size={13} color={colors.ink3} tabular>
                      +45 kcal · +5 g fat (1 tsp)
                    </Text>
                  </View>
                  <Switch checked={ghee} onChange={setGhee} label="Cooked with ghee or oil" />
                </Card>
              )}

              <Card style={{ gap: 10 }}>
                <Text weight={600}>Details</Text>
                <TextInput
                  accessibilityLabel="Details"
                  value={note}
                  onChangeText={setNote}
                  multiline
                  maxLength={500}
                  placeholder="e.g. small cup, 2 sachets sugar, full-cream milk"
                  placeholderTextColor="rgba(107,110,118,0.6)"
                  style={styles.note}
                  textAlignVertical="top"
                />
                <Text size={13} color={colors.ink3}>
                  Saved with the meal. Re-check to let the AI correct the items using your details.
                </Text>
                <Button
                  variant="secondary"
                  icon={Sparkles}
                  onPress={() => recheck(true)}
                  loading={rechecking}
                  disabled={note.trim().length < 2}
                >
                  Re-check with details
                </Button>
              </Card>
            </>
          )}
        </View>
      </ScrollView>

      {editing && (
        <View style={[styles.footer, { paddingBottom: Math.max(16, insets.bottom) }]}>
          <View style={styles.total}>
            <View>
              <Text weight={600} size={12} color={colors.ink3}>
                Total
              </Text>
              <Text variant="h1" size={26} tabular accessibilityLiveRegion="polite">
                {formatInt(sum.kcal)}{" "}
                <Text weight={600} size={13} color={colors.ink3}>
                  kcal
                </Text>
              </Text>
            </View>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Text weight={600} size={13} color={colors.protein} tabular>
                P {formatInt(sum.proteinG)} g
              </Text>
              <Text weight={600} size={13} color={colors.carbsText} tabular>
                C {formatInt(sum.carbsG)} g
              </Text>
              <Text weight={600} size={13} color={colors.fat} tabular>
                F {formatInt(sum.fatG)} g
              </Text>
            </View>
          </View>
          {error && <FieldError>{error}</FieldError>}
          <Button onPress={save} loading={saving} disabled={rows.length === 0}>
            {saved ? "Save changes" : `Save to ${mealLabel}`}
          </Button>
        </View>
      )}

      <AiLimitSheet open={limitOpen} onClose={() => setLimitOpen(false)} mealType={meal.mealType} usage={limit} />
      <AddItemSheet
        open={addOpen}
        mealType={meal.mealType}
        onClose={() => setAddOpen(false)}
        onAdd={(added) => {
          setRows((all) => [...all, ...added]);
          setAddOpen(false);
        }}
      />
    </KeyboardAvoidingView>
  );
}

function Header({ meal, scanning, top }: { meal: MealDto; scanning: boolean; top: number }) {
  const back = (onPhoto: boolean) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back to today"
      onPress={() => router.dismissTo("/today")}
      style={[styles.back, onPhoto && { backgroundColor: "rgba(23,24,28,0.55)" }]}
    >
      <ChevronLeft size={26} color={onPhoto ? colors.white : colors.ink} />
    </Pressable>
  );
  if (meal.photoUrl) {
    return (
      <View style={{ height: 224 + top, backgroundColor: colors.sunken, overflow: "hidden" }}>
        <Image
          source={{ uri: meal.photoUrl }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          accessibilityLabel={`Your ${MEAL_LABEL[meal.mealType].toLowerCase()} photo`}
        />
        {scanning && <ScanLine height={224 + top} />}
        <View style={{ position: "absolute", top: top + 8, left: 12 }}>{back(true)}</View>
      </View>
    );
  }
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, paddingTop: top + 8 }}>
      {back(false)}
      <NotebookPen size={16} color={colors.ink3} />
      <Text weight={600} size={13} color={colors.ink3} numberOfLines={1} style={{ flex: 1 }}>
        {MEAL_LABEL[meal.mealType]}
        {meal.inputText ? ` · “${meal.inputText}”` : ""}
      </Text>
    </View>
  );
}

/** Design 8: animated scan line over the photo. */
function ScanLine({ height }: { height: number }) {
  const [y] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const ease = Easing.inOut(Easing.ease);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(y, { toValue: 1, duration: 1600, easing: ease, useNativeDriver: true }),
        Animated.timing(y, { toValue: 0, duration: 1600, easing: ease, useNativeDriver: true }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [y]);
  return (
    <Animated.View
      aria-hidden
      style={[
        styles.scan,
        { transform: [{ translateY: y.interpolate({ inputRange: [0, 1], outputRange: [0, height - 2] }) }] },
      ]}
    />
  );
}

const styles = StyleSheet.create({
  back: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  delete: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 8, marginRight: -8 },
  row: { flexDirection: "row", alignItems: "center", gap: 16 },
  note: {
    minHeight: 64,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: fonts.sans400,
    fontSize: 15,
    color: colors.ink,
  },
  footer: {
    paddingTop: 12,
    paddingHorizontal: 20,
    gap: 12,
    backgroundColor: colors.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
  total: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  scan: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    height: 2,
    backgroundColor: colors.brandGlow,
    boxShadow: "0 0 16px 4px rgba(232, 119, 46, 0.6)",
  },
});
