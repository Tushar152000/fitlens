import { useQuery } from "@tanstack/react-query";
import { ProgressSkeleton } from "@/components/skeletons";
import { useState } from "react";
import { View } from "react-native";
import { QueryError } from "@/components/query-error";
import { TrendChart, type Progress } from "@/components/trend-chart";
import { Button, Card, FieldError, InsightCard, NumberField, Screen, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { formatInt } from "@/lib/format";
import { queryClient } from "@/lib/query";
import { colors, radius } from "@/lib/theme";

const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)} kg`;

/** Headline + one-line reason for the week, with the numbers behind it. Targets change only via recompute. */
function insight(p: Progress) {
  const kcal = p.target ? `${formatInt(p.target.kcal)} kcal` : "your target";
  if (p.weeklyChange == null) {
    return {
      headline: `Targets stay at ${kcal}`,
      reason:
        p.points.length < 2
          ? "Weigh in once a week, same time of day. After two weekly check-ins we can compare your trend with the plan."
          : "Log a weigh-in this week and last week so we can compare your weekly trend with the plan.",
    };
  }
  const planned = p.plan.weeklyChangeKg;
  const actual = p.weeklyChange;
  const onTrack = Math.abs(actual - planned) <= 0.25;
  return {
    headline: onTrack ? `On track — targets stay at ${kcal}` : `Targets stay at ${kcal} for now`,
    reason: `${signed(actual)} this week vs ${signed(planned)} planned (7-day averages).${
      onTrack ? "" : " One week is noisy — we'll look at the next check-in before changing anything."
    }`,
  };
}

/** Screen 11: weekly check-in, trend vs plan, last-7-day stats. */
export default function ProgressScreen() {
  const progress = useQuery({ queryKey: ["progress"], queryFn: () => api<Progress>("/api/progress") });

  return (
    <Screen tabBar refreshing={progress.isRefetching} onRefresh={() => progress.refetch()}>
      <View>
        <Text variant="meta">Weekly check-in</Text>
        <Text variant="h1">Progress</Text>
      </View>
      {progress.isPending ? (
        <ProgressSkeleton />
      ) : progress.isError ? (
        <QueryError error={progress.error} onRetry={() => progress.refetch()} />
      ) : (
        <ProgressBody p={progress.data} />
      )}
    </Screen>
  );
}

function ProgressBody({ p }: { p: Progress }) {
  const { headline, reason } = insight(p);
  return (
    <>
      <CheckinForm lastWeightKg={p.latest?.weightKg ?? null} lastWaistCm={p.latest?.waistCm ?? null} />
      <InsightCard headline={headline} reason={reason} />
      <Card>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
          <Text variant="h2">Weight trend</Text>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 16, height: 2, borderRadius: 1, backgroundColor: colors.brand }} />
              <Text weight={600} size={12} color={colors.ink3}>
                You
              </Text>
            </View>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={{ width: 16, borderTopWidth: 2, borderStyle: "dashed", borderColor: colors.ink3 }} />
              <Text weight={600} size={12} color={colors.ink3}>
                Plan
              </Text>
            </View>
          </View>
        </View>
        <TrendChart points={p.points} plan={p.plan} />
      </Card>
      <View style={{ flexDirection: "row", gap: 8 }} accessibilityLabel="Last 7 days">
        <Tile
          label="Avg intake"
          value={p.avgIntake == null ? "—" : formatInt(p.avgIntake)}
          sub={p.avgIntake == null ? "no meals yet" : "kcal a day"}
        />
        <Tile label="Days logged" value={`${p.daysLogged}/7`} sub="last 7 days" />
        <Tile label="Workouts" value="—" sub="tracking soon" />
      </View>
    </>
  );
}

function CheckinForm({ lastWeightKg, lastWaistCm }: { lastWeightKg: number | null; lastWaistCm: number | null }) {
  const [weight, setWeight] = useState("");
  const [waist, setWaist] = useState("");
  const [errors, setErrors] = useState<{ weight?: string; waist?: string }>({});
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [serverError, setServerError] = useState<string | null>(null);

  async function submit() {
    const w = Number(weight);
    const wc = waist.trim() ? Number(waist) : undefined;
    const next: typeof errors = {};
    if (!weight.trim() || !Number.isFinite(w) || w < 30 || w > 250) next.weight = "Enter weight between 30 and 250";
    if (wc !== undefined && (!Number.isFinite(wc) || wc < 40 || wc > 200))
      next.waist = "Enter waist between 40 and 200";
    setErrors(next);
    if (Object.keys(next).length) return;

    setStatus("saving");
    setServerError(null);
    try {
      await api("/api/checkins", { json: { weightKg: w, waistCm: wc } });
      setStatus("saved");
      setWeight("");
      setWaist("");
      queryClient.invalidateQueries({ queryKey: ["progress"] });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : "Couldn't save. Try again.");
      setStatus("idle");
    }
  }

  return (
    <Card>
      <View style={{ flexDirection: "row", gap: 12 }}>
        <NumberField
          label="Weight"
          unit="kg"
          placeholder={lastWeightKg != null ? String(lastWeightKg) : "75"}
          value={weight}
          onValueChange={(v) => {
            setWeight(v);
            setStatus("idle");
          }}
          error={errors.weight}
        />
        <NumberField
          label="Waist (optional)"
          unit="cm"
          placeholder={lastWaistCm != null ? String(lastWaistCm) : "85"}
          value={waist}
          onValueChange={(v) => {
            setWaist(v);
            setStatus("idle");
          }}
          error={errors.waist}
        />
      </View>
      <Text size={13} color={colors.ink3}>
        Weigh in the morning, after the loo, before food.
      </Text>
      {serverError && <FieldError>{serverError}</FieldError>}
      <Button variant="strong" onPress={submit} loading={status === "saving"}>
        {status === "saved" ? "Saved — thanks" : "Save check-in"}
      </Button>
    </Card>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <View style={{ flex: 1, borderRadius: radius.card, backgroundColor: colors.surface, padding: 12 }}>
      <Text weight={600} size={12} color={colors.ink3}>
        {label}
      </Text>
      <Text variant="h2" size={22} tabular>
        {value}
      </Text>
      <Text size={12} color={colors.ink3}>
        {sub}
      </Text>
    </View>
  );
}
