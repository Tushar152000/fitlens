import { useQuery } from "@tanstack/react-query";
import type { SavedMealDto } from "@fitr8/contracts";
import { router, useLocalSearchParams } from "expo-router";
import { Plus, Trash2 } from "lucide-react-native";
import { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AddItemSheet } from "@/components/log/add-item-sheet";
import { BackHeader } from "@/components/back-header";
import { FormSkeleton } from "@/components/skeletons";
import { Button, Card, Chip, FieldError, MealItemEditor, Screen, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { track } from "@/lib/analytics";
import { confirmAction } from "@/lib/confirm";
import { formatInt, MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/format";
import { mealFromParam } from "@/lib/meal-param";
import { scaleRow, setRowGrams, totals, type Row } from "@/lib/meal-rows";
import { queryClient } from "@/lib/query";
import { savedMealsQuery } from "@/lib/queries";
import { rowsFromSaved, toSavedPayload } from "@/lib/saved-meals";
import { colors, fonts, radius } from "@/lib/theme";

/** Build or edit a saved meal: a name, an optional usual slot, and the items. `id` is "new" to create. */
export default function SavedMealRoute() {
  const { id, meal } = useLocalSearchParams<{ id: string; meal?: string }>();
  const creating = id === "new";
  const list = useQuery({ ...savedMealsQuery, enabled: !creating });

  if (!creating && list.isPending) {
    return (
      <Screen>
        <BackHeader />
        <FormSkeleton />
      </Screen>
    );
  }
  const existing = creating ? null : (list.data?.find((m) => m.id === id) ?? null);
  if (!creating && !existing) {
    return (
      <Screen>
        <BackHeader />
        <View style={{ gap: 8, marginTop: 24 }}>
          <Text variant="h1">Saved meal not found</Text>
          <Text color={colors.ink2}>It may have been deleted on another device.</Text>
        </View>
      </Screen>
    );
  }
  return <Builder existing={existing} defaultMeal={mealFromParam(meal)} />;
}

function Builder({ existing, defaultMeal }: { existing: SavedMealDto | null; defaultMeal: MealType | null }) {
  const [name, setName] = useState(existing?.name ?? "");
  const [mealType, setMealType] = useState<MealType | null>(existing ? existing.mealType : defaultMeal);
  const [rows, setRows] = useState<Row[]>(() => (existing ? rowsFromSaved(existing) : []));
  const [addOpen, setAddOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const sum = totals(rows, false);

  async function save() {
    if (!name.trim()) {
      setNameError("Give it a name, e.g. Usual breakfast");
      return;
    }
    if (!rows.length) {
      setError("Add at least one item.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const body = toSavedPayload(name, mealType, rows);
      if (existing) await api(`/api/saved-meals/${existing.id}`, { method: "PUT", json: body });
      else {
        await api("/api/saved-meals", { json: body });
        track("saved_meal_created", { from: "builder" });
      }
      await queryClient.invalidateQueries({ queryKey: savedMealsQuery.queryKey });
      router.back();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  async function remove() {
    if (!existing) return;
    if (!(await confirmAction(`Delete "${existing.name}"?`, "Meals you already logged stay as they are.", "Delete")))
      return;
    try {
      await api(`/api/saved-meals/${existing.id}`, { method: "DELETE" });
      await queryClient.invalidateQueries({ queryKey: savedMealsQuery.queryKey });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't delete. Try again.");
    }
  }

  return (
    <Screen
      footer={
        <>
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
            <View style={{ alignItems: "flex-end" }}>
              <Text weight={600} size={13} color={colors.protein} tabular>
                {formatInt(sum.proteinG)} g protein
              </Text>
              <Text weight={600} size={13} color={colors.carbsText} tabular>
                {formatInt(sum.carbsG)} g carbs · {formatInt(sum.fatG)} g fat
              </Text>
            </View>
          </View>
          {error && <FieldError>{error}</FieldError>}
          <Button onPress={save} loading={busy} disabled={rows.length === 0}>
            {existing ? "Save changes" : "Save meal"}
          </Button>
        </>
      }
    >
      <BackHeader>
        {existing && (
          <Pressable
            accessibilityRole="button"
            onPress={remove}
            style={[styles.delete, { alignSelf: "flex-end" }]}
            hitSlop={6}
          >
            <Trash2 size={16} color={colors.ink3} />
            <Text weight={600} size={13} color={colors.ink3}>
              Delete
            </Text>
          </Pressable>
        )}
      </BackHeader>

      <View style={{ gap: 6 }}>
        <Text variant="h1">{existing ? "Edit saved meal" : "New saved meal"}</Text>
        <Text color={colors.ink2}>
          Save a meal you eat often. Next time it&apos;s one tap to log — no photo, no AI scan.
        </Text>
      </View>

      <View style={{ gap: 8 }}>
        <Text weight={600} size={13} color={colors.ink2}>
          Name
        </Text>
        <TextInput
          accessibilityLabel="Name"
          value={name}
          onChangeText={(v) => {
            setName(v);
            setNameError(null);
          }}
          maxLength={60}
          placeholder="e.g. Usual breakfast, Post-workout shake"
          placeholderTextColor="rgba(107,110,118,0.6)"
          style={styles.input}
          returnKeyType="done"
        />
        {nameError && <FieldError>{nameError}</FieldError>}
      </View>

      <View style={{ gap: 8 }}>
        <Text weight={600} size={13} color={colors.ink2}>
          Usually for (optional)
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }} accessibilityLabel="Usually for">
          {MEAL_TYPES.map((t) => (
            <Chip key={t} selected={t === mealType} onPress={() => setMealType(t === mealType ? null : t)}>
              {MEAL_LABEL[t]}
            </Chip>
          ))}
        </View>
      </View>

      <View style={{ gap: 10 }}>
        <Text variant="h2">Items</Text>
        {rows.length === 0 && (
          <Card>
            <Text color={colors.ink2}>
              Search the food list, or describe it (&quot;2 roti and 1 katori dal&quot;) and we&apos;ll work out the
              numbers.
            </Text>
          </Card>
        )}
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
          {rows.length ? "Add another item" : "Add an item"}
        </Button>
      </View>

      <AddItemSheet
        open={addOpen}
        mealType={mealType ?? "SNACK"}
        onClose={() => setAddOpen(false)}
        onAdd={(added) => {
          setRows((all) => [...all, ...added]);
          setAddOpen(false);
          setError(null);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans600,
    fontSize: 17,
    color: colors.ink,
  },
  total: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 12 },
  delete: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 44, paddingHorizontal: 4 },
});
