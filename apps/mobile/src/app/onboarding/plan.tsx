import { useQuery } from "@tanstack/react-query";
import { PlanSkeleton } from "@/components/skeletons";
import { router } from "expo-router";
import { CircleCheck, TriangleAlert } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { QueryError } from "@/components/query-error";
import { Button, Card, ChoiceCardGroup, FieldError, ProgressSteps, Screen, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { formatInt } from "@/lib/format";
import { premiumIntroAfterOnboarding } from "@/lib/premium";
import { makeStyles, radius, useColors, type Colors } from "@/lib/theme";
import type { PlanResponse, PlanSummary } from "@/lib/types-plan";

const dateLabel = (ymd: string) =>
  new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(
    new Date(ymd),
  );

/** Screens 5 / 5b: the plan computed at onboarding, or the two safe options when the goal is too fast. */
export default function PlanScreen() {
  const { refresh } = useAuth();
  const plan = useQuery({ queryKey: ["plan"], queryFn: () => api<PlanResponse>("/api/plan") });
  const [starting, setStarting] = useState(false);
  const c = useColors();
  const styles = useStyles();

  // Onboarding is saved; re-reading /api/me flips the app into the signed-in tabs.
  async function start() {
    setStarting(true);
    await refresh().catch(() => setStarting(false));
    premiumIntroAfterOnboarding();
    router.replace("/today");
  }

  if (plan.isPending) {
    return (
      <Screen gutter={24}>
        <View style={{ minHeight: 44, justifyContent: "center" }}>
          <ProgressSteps current={4} total={4} />
        </View>
        <PlanSkeleton />
      </Screen>
    );
  }
  if (plan.isError) {
    return (
      <Screen gutter={24}>
        <QueryError error={plan.error} onRetry={() => plan.refetch()} />
      </Screen>
    );
  }

  const { summary, goal, metric } = plan.data;
  const recomp = goal.type === "RECOMPOSITION";
  if (!summary.plan.feasible && !recomp) {
    return <TooFast data={plan.data} onStart={start} starting={starting} />;
  }

  const pace = paceLine(summary.plan.weeklyChangeKg, metric.weightKg, summary.plan.targetWeightKg);
  return (
    <Screen
      gutter={24}
      footer={
        <Button onPress={start} loading={starting}>
          Start my plan
        </Button>
      }
    >
      <View style={{ minHeight: 44, justifyContent: "center" }}>
        <ProgressSteps current={4} total={4} />
      </View>
      <View style={{ gap: 12 }}>
        <Text variant="h1">Your plan</Text>
        <View style={[styles.badge, { backgroundColor: c.proteinSoft }]}>
          <CircleCheck size={16} color={c.protein} />
          <Text weight={600} size={13} color={c.protein}>
            {pace.atTarget && !recomp ? "At your target weight" : "Realistic goal"}
          </Text>
        </View>
      </View>

      <View style={{ gap: 12 }}>
        <Card>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" }}>
            <View>
              <Text weight={600} size={12} color={c.ink3}>
                Now
              </Text>
              <Text variant="h1" size={26} tabular>
                {metric.weightKg}{" "}
                <Text weight={600} size={15} color={c.ink3}>
                  kg
                </Text>
              </Text>
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Text weight={600} size={12} color={c.ink3}>
                Goal · {dateLabel(goal.targetDate)}
              </Text>
              <Text variant="h1" size={26} tabular>
                {recomp ? "Hold" : summary.plan.targetWeightKg}{" "}
                <Text weight={600} size={15} color={c.ink3}>
                  {recomp ? "weight" : "kg"}
                </Text>
              </Text>
            </View>
          </View>
          <ProjectionLine from={metric.weightKg} to={recomp ? metric.weightKg : summary.plan.targetWeightKg} />
          <Text size={13} color={c.ink2}>
            {recomp ? "Weight stays steady while you lose fat and build muscle." : pace.text}
            {goal.targetBodyFatPct != null && ` · body fat ${summary.bodyFatPct ?? "?"}% → ${goal.targetBodyFatPct}%`}
          </Text>
        </Card>

        <TargetCard summary={summary} />

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Tile
            label="BMI"
            value={String(summary.bmi.value)}
            sub={summary.bmi.category.charAt(0).toUpperCase() + summary.bmi.category.slice(1)}
          />
          <Tile label="BMR" value={formatInt(summary.plan.bmr)} sub="kcal at rest" />
          <Tile
            label="Workouts"
            value={`${plan.data.training.daysPerWeek}×`}
            sub={`a week, ${plan.data.training.sessionMinutes} min`}
          />
        </View>
      </View>

      {summary.plan.warnings.length > 0 && (
        <View style={{ gap: 6 }}>
          {summary.plan.warnings.map((w) => (
            <View key={w} style={{ flexDirection: "row", gap: 8 }}>
              <View style={styles.bullet} />
              <Text size={13} color={c.ink2} style={{ flex: 1 }}>
                {w}
              </Text>
            </View>
          ))}
        </View>
      )}
    </Screen>
  );
}

/**
 * The pace line under Now → Goal. A directional goal with no weight change (target equals current
 * weight, or a medical / under-18 hold) reads as words, never "0 kg a week".
 */
function paceLine(weekly: number, nowKg: number, targetKg: number): { text: string; atTarget: boolean } {
  if (Math.abs(weekly) >= 0.05) {
    return { text: `${weekly > 0 ? "+" : "−"}${Math.abs(weekly)} kg a week`, atTarget: false };
  }
  if (Math.abs(targetKg - nowKg) < 0.5) {
    return {
      text: "You're already at your target weight, so there's no weight to change. Your plan keeps it steady.",
      atTarget: true,
    };
  }
  return { text: "Your weight stays steady for now.", atTarget: false };
}

type Choice = "KEEP_GOAL" | "KEEP_DATE";

/** Design 5b: the goal needs an unsafe pace; pick a later date or a closer target. */
function TooFast({ data, onStart, starting }: { data: PlanResponse; onStart: () => void; starting: boolean }) {
  const { summary, goal } = data;
  const p = summary.plan;
  const suggestedDate = p.suggestedTargetDate ?? null;
  const closer = p.closerTargetWeightKg != null ? Math.round(p.closerTargetWeightKg * 2) / 2 : null;
  const [choice, setChoice] = useState<Choice>(suggestedDate ? "KEEP_GOAL" : "KEEP_DATE");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const c = useColors();
  const styles = useStyles();
  const verb = goal.type === "FAT_LOSS" ? "Losing" : "Gaining";

  async function start() {
    setBusy(true);
    setError(null);
    try {
      await api("/api/goal/option", { json: { choice } });
      onStart();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't save. Try again.");
      setBusy(false);
    }
  }

  return (
    <Screen
      gutter={24}
      footer={
        <>
          {error && <FieldError>{error}</FieldError>}
          <Button onPress={start} loading={busy || starting}>
            {choice === "KEEP_GOAL" && suggestedDate
              ? `Start — goal by ${dateLabel(suggestedDate)}`
              : `Start — ${closer} kg by ${dateLabel(goal.targetDate)}`}
          </Button>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/onboarding")}
            style={{ minHeight: 44, alignItems: "center", justifyContent: "center" }}
          >
            <Text weight={600} color={c.ink2}>
              Change my goal
            </Text>
          </Pressable>
        </>
      }
    >
      <View style={{ minHeight: 44, justifyContent: "center" }}>
        <ProgressSteps current={4} total={4} />
      </View>
      <View style={{ gap: 12 }}>
        <View style={[styles.badge, { backgroundColor: c.cautionSoft }]}>
          <TriangleAlert size={16} color={c.cautionText} />
          <Text weight={600} size={13} color={c.cautionText}>
            Too fast to be safe
          </Text>
        </View>
        <Text variant="h1">
          {verb} {Math.abs(p.neededWeeklyChangeKg).toFixed(1)} kg a week isn&apos;t safe
        </Text>
        <Text color={c.ink2}>
          A safe pace for you is about {Math.abs(p.weeklyChangeKg).toFixed(1)} kg a week. Pick what matters more:
        </Text>
      </View>

      <ChoiceCardGroup
        label="Safer option"
        value={choice}
        onChange={setChoice}
        options={[
          ...(suggestedDate
            ? [
                {
                  value: "KEEP_GOAL" as const,
                  label: "Keep the goal · recommended",
                  description: `Reach ${p.targetWeightKg} kg by ${dateLabel(suggestedDate)}`,
                },
              ]
            : []),
          ...(closer != null
            ? [
                {
                  value: "KEEP_DATE" as const,
                  label: "Keep the date",
                  description: `Reach ${closer} kg by ${dateLabel(goal.targetDate)}, then keep going`,
                },
              ]
            : []),
        ]}
      />

      <View style={{ gap: 8 }}>
        <Text variant="meta">Your daily target either way</Text>
        <TargetCard summary={summary} />
      </View>
    </Screen>
  );
}

/** Dots on the dark target card; protein and fat are lifted shades that read on the panel. */
const macroDots = (c: Colors) => ({ protein: "#5fae88", carbs: c.carbs, fat: "#9d84d6" });

function TargetCard({ summary }: { summary: PlanSummary }) {
  const c = useColors();
  const styles = useStyles();
  const MACRO_DOTS = macroDots(c);
  const { kcal, proteinG, carbsG, fatG } = summary.target;
  const adjustment = kcal - summary.plan.tdee;
  const k = { p: proteinG * 4, c: carbsG * 4, f: fatG * 9 };
  const total = k.p + k.c + k.f || 1;
  const white70 = "rgba(255,255,255,0.7)";
  return (
    <Card dark style={{ padding: 20, gap: 0 }}>
      <Text weight={600} size={13} color={white70}>
        Daily target
      </Text>
      <Text variant="display" color={c.white} tabular>
        {formatInt(kcal)}{" "}
        <Text weight={600} size={15} color={white70}>
          kcal
        </Text>
      </Text>
      <Text size={13} color={white70} tabular style={{ marginTop: 6 }}>
        Maintenance {formatInt(summary.plan.tdee)} kcal
        {Math.abs(adjustment) >= 10 &&
          ` ${adjustment < 0 ? "−" : "+"} ${formatInt(Math.abs(adjustment))} kcal ${adjustment < 0 ? "deficit" : "surplus"}`}
      </Text>
      <View
        style={styles.split}
        accessible
        accessibilityLabel={`Split: protein ${Math.round((k.p / total) * 100)}%, carbs ${Math.round((k.c / total) * 100)}%, fat ${Math.round((k.f / total) * 100)}% of calories`}
      >
        <View style={{ flex: k.p, backgroundColor: MACRO_DOTS.protein }} />
        <View style={{ flex: k.c, backgroundColor: MACRO_DOTS.carbs }} />
        <View style={{ flex: k.f, backgroundColor: MACRO_DOTS.fat }} />
      </View>
      <View style={{ flexDirection: "row", marginTop: 12 }}>
        <Macro label="Protein" grams={proteinG} dot={MACRO_DOTS.protein} />
        <Macro label="Carbs" grams={carbsG} dot={MACRO_DOTS.carbs} />
        <Macro label="Fat" grams={fatG} dot={MACRO_DOTS.fat} />
      </View>
    </Card>
  );
}

function Macro({ label, grams, dot }: { label: string; grams: number; dot: string }) {
  const c = useColors();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: dot }} />
        <Text size={13} color="rgba(255,255,255,0.7)">
          {label}
        </Text>
      </View>
      <Text weight={700} size={16} color={c.white} tabular>
        {grams} g
      </Text>
    </View>
  );
}

function Tile({ label, value, sub }: { label: string; value: string; sub: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.tile}>
      <Text weight={600} size={12} color={c.ink3}>
        {label}
      </Text>
      <Text variant="h2" size={22} tabular>
        {value}
      </Text>
      <Text size={12} color={c.ink3}>
        {sub}
      </Text>
    </View>
  );
}

/** Straight-line projection from now to goal. Decorative; the numbers above carry the meaning. */
function ProjectionLine({ from, to }: { from: number; to: number }) {
  const c = useColors();
  const w = 300;
  const h = 64;
  const pad = 8;
  const flat = Math.abs(from - to) < 0.1;
  const y1 = flat ? h / 2 : from > to ? pad : h - pad;
  const y2 = flat ? h / 2 : from > to ? h - pad : pad;
  return (
    <Svg viewBox={`0 0 ${w} ${h}`} width="100%" height={64} aria-hidden>
      <Line x1={pad} y1={y1} x2={w - pad} y2={y2} stroke={c.line} strokeWidth={2} />
      <Line
        x1={pad}
        y1={y1}
        x2={w - pad}
        y2={y2}
        stroke={c.brand}
        strokeWidth={2.5}
        strokeDasharray="6 6"
        strokeLinecap="round"
      />
      <Circle cx={pad} cy={y1} r={5} fill={c.ink} />
      <Circle cx={w - pad} cy={y2} r={5} fill={c.brand} />
    </Svg>
  );
}

const useStyles = makeStyles((c) => ({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  split: { flexDirection: "row", height: 10, gap: 2, borderRadius: 5, overflow: "hidden", marginTop: 16 },
  tile: { flex: 1, borderRadius: radius.card, backgroundColor: c.surface, padding: 12 },
  bullet: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.ink3, marginTop: 9 },
}));
