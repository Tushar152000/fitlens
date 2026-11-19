import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { TodaySkeleton } from "@/components/skeletons";
import { router } from "expo-router";
import type { ProgressDto } from "@fitr8/contracts";
import {
  Camera,
  ChevronLeft,
  ChevronRight,
  Flame,
  History,
  Keyboard,
  Plus,
  TrendingDown,
  TrendingUp,
} from "lucide-react-native";
import { Pressable, View } from "react-native";
import { GestureDetector } from "react-native-gesture-handler";
import { Button, Card, CalorieRing, InsightCard, MacroBar, MealRow, Screen, Skeleton, Text } from "@/components/ui";
import { DAY_WINDOW_RADIUS, DayStrip, useDayPager } from "@/components/day-pager";
import { QueryError } from "@/components/query-error";
import { useWater, WaterBar, WaterQuickAdd } from "@/components/water-card";
import { queryClient } from "@/lib/query";
import { useMe } from "@/lib/auth";
import { formatInt, formatTime, MEAL_LABEL, MEAL_TYPES, mealTitle } from "@/lib/format";
import { dayFromParam, dayLabel, recentDays } from "@/lib/meal-param";
import { dayQuery, dayQueryFor, progressQuery } from "@/lib/queries";
import { showDay, useViewDay } from "@/lib/view-day";
import { makeStyles, radius, useColors } from "@/lib/theme";
import type { Day } from "@/lib/types";
import { usePremiumIntro } from "@/lib/premium";

function greeting(hour: number) {
  if (hour < 5) return "Up late";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Screen 6: intake vs targets for today (or a recent day, to fill in a forgotten meal), meals, and progress. */
export default function TodayScreen() {
  const me = useMe();
  usePremiumIntro(me.id);
  // null = today. A day that has slid out of the window (app left open for days) falls back to today.
  const viewDay = dayFromParam(useViewDay() ?? undefined);
  // The header is about today (greeting, date), so its streak always comes from today's data, even
  // while a past day is shown below.
  const today = useQuery(dayQuery);
  const streak = today.data?.streak ?? 0;
  const days = recentDays(); // today first
  const index = viewDay ? Math.max(0, days.indexOf(viewDay)) : 0;
  // Stable on purpose: the day pager builds its swipe gesture once from it (see day-pager.tsx).
  const go = useCallback((i: number) => {
    const all = recentDays();
    showDay(i <= 0 ? null : all[Math.min(i, all.length - 1)]);
  }, []);
  const canOlder = index < days.length - 1;
  const canNewer = index > 0;
  const pager = useDayPager({ days, index, onIndex: go });
  // The strip renders a 5-day window (each page loads its own day). Fetch the next day just outside
  // it too, so when a swipe moves the window the newly rendered page is already in the cache.
  useEffect(() => {
    for (const i of [index - DAY_WINDOW_RADIUS - 1, index + DAY_WINDOW_RADIUS + 1]) {
      if (i >= 0 && i < days.length) void queryClient.prefetchQuery(dayQueryFor(i === 0 ? null : days[i]));
    }
    // `days` only changes at midnight; the index is what moves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index]);
  const c = useColors();
  const styles = useStyles();

  const now = new Date();
  const hour = now.getHours();
  const dateText = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "short" }).format(now);
  const firstName = me.name?.split(" ")[0];

  const [refreshing, setRefreshing] = useState(false);
  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["day"] }),
      queryClient.invalidateQueries({ queryKey: ["progress"] }),
      queryClient.invalidateQueries({ queryKey: ["water"] }),
    ]);
    setRefreshing(false);
  };

  return (
    // A horizontal swipe anywhere on the screen pages between days; only the day strip moves.
    <GestureDetector gesture={pager.gesture}>
      <View style={{ flex: 1 }}>
        <Screen tabBar refreshing={refreshing} onRefresh={refresh}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text variant="meta">{dateText}</Text>
              <Text variant="h1">
                {greeting(hour)}
                {firstName ? `, ${firstName}` : ""}
              </Text>
            </View>
            {streak > 0 && (
              <View style={styles.streak}>
                <Flame size={16} color={c.brandGlow} fill={c.brandGlow} />
                <Text weight={700} size={13} tabular>
                  {streak}-day streak
                </Text>
              </View>
            )}
          </View>

          <DaySwitcher
            day={days[index]}
            canOlder={canOlder}
            canNewer={canNewer}
            onOlder={() => go(index + 1)}
            onNewer={() => go(index - 1)}
            onToday={() => go(0)}
          />

          <DayStrip
            pager={pager}
            days={days}
            index={index}
            renderDay={(date, current) => <DayPage date={date} isToday={date === days[0]} current={current} />}
          />
        </Screen>
      </View>
    </GestureDetector>
  );
}

/**
 * One page of the strip: that day's card and meals (and, on today, the Progress card). Each page
 * fetches its own day, so the neighbours either side are loaded before they're swiped in; a page
 * still loading shows the day skeleton in place.
 */
function DayPage({ date, isToday, current }: { date: string; isToday: boolean; current: boolean }) {
  const day = useQuery(dayQueryFor(isToday ? null : date));
  const progress = useQuery({ ...progressQuery, enabled: isToday });
  if (day.isPending) return <TodaySkeleton />;
  if (day.isError) {
    return current ? <QueryError error={day.error} onRetry={() => day.refetch()} /> : <TodaySkeleton />;
  }
  return (
    <>
      <DayContent day={day.data} pastDay={isToday ? null : date} />
      {isToday && (
        <View style={{ gap: 10 }}>
          <Text variant="h2">Progress</Text>
          {progress.isPending ? (
            <Skeleton height={132} radius={radius.card} />
          ) : progress.isError ? (
            <QueryError error={progress.error} onRetry={() => progress.refetch()} />
          ) : (
            <ProgressCard p={progress.data} />
          )}
        </View>
      )}
    </>
  );
}

function DayContent({ day, pastDay }: { day: Day; pastDay: string | null }) {
  const c = useColors();
  const styles = useStyles();
  const target = day.target;
  const water = useWater();
  const over = target ? day.eaten.kcal - target.kcal : 0;
  const positiveNote =
    target && day.eaten.proteinG >= target.proteinG
      ? `You still hit your protein (${Math.round(day.eaten.proteinG)} g) — that's what matters most. Tomorrow resets.`
      : day.streak > 1
        ? `You've logged ${day.streak} days in a row. One day over doesn't undo that. Tomorrow resets.`
        : "Logging it honestly is the hard part, and you did it. Tomorrow resets.";
  // One way in: the log screens pick the meal from the time of day (changeable there and later);
  // a past day carries its date.
  const logParams = () => (pastDay ? { date: pastDay } : {});
  // A past meal is long eaten: typing it is the default there, the camera is for today.
  const logPath = pastDay ? "/log/type" : "/log";
  const dayName = pastDay ? dayLabel(pastDay).toLowerCase() : "today";

  return (
    <>
      {target ? (
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
            <CalorieRing eaten={day.eaten.kcal} target={target.kcal} size={148} />
            <View style={{ flex: 1, gap: 10 }}>
              <MacroBar macro="protein" eaten={day.eaten.proteinG} target={target.proteinG} />
              <MacroBar macro="carbs" eaten={day.eaten.carbsG} target={target.carbsG} />
              <MacroBar macro="fat" eaten={day.eaten.fatG} target={target.fatG} />
              {!pastDay && <WaterBar day={water.water.data} />}
            </View>
          </View>
          <View style={styles.divider} />
          <Text size={13} color={c.ink2} tabular>
            {formatInt(day.eaten.kcal)} eaten of {formatInt(target.kcal)} kcal target
          </Text>
          {!pastDay && <WaterQuickAdd water={water} />}
        </Card>
      ) : (
        <Card>
          <Text color={c.ink2}>No targets yet. Finish your plan on the Profile tab.</Text>
        </Card>
      )}

      {target && over > 0 && <InsightCard headline="A little over. No stress." reason={positiveNote} />}

      <View style={{ gap: 10 }}>
        <View style={[styles.sectionHead, { alignItems: "center" }]}>
          <Text variant="h2">Meals</Text>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Past logs"
            onPress={() => router.push("/history")}
            hitSlop={8}
            style={({ pressed }) => [styles.pastLogs, pressed && { backgroundColor: c.sunken }]}
          >
            <History size={16} color={c.brandText} strokeWidth={2.25} />
            <Text weight={600} size={15} color={c.brandText}>
              Past logs
            </Text>
          </Pressable>
        </View>

        {day.meals.length === 0 && (
          // Design 6b: nothing logged yet. Snap / Type set the meal from the time (changeable there).
          <Card dark>
            <View style={{ gap: 4 }}>
              <Text variant="h2" size={22} color={c.white}>
                {pastDay ? `Nothing logged for ${dayName}` : "Log your first meal"}
              </Text>
              <Text size={13} color="rgba(255,255,255,0.75)">
                {pastDay
                  ? "Forgot to log? Type what you ate and it counts for that day."
                  : "Snap your plate and we'll find the foods, or type it in a line."}
              </Text>
            </View>
            {/* Today: Snap first. A past day: Type first (the meal is long eaten). */}
            <View style={{ flexDirection: pastDay ? "row-reverse" : "row", gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  variant={pastDay ? "ghostDark" : "primary"}
                  icon={Camera}
                  onPress={() => router.push({ pathname: "/log", params: logParams() })}
                >
                  Snap
                </Button>
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  variant={pastDay ? "primary" : "ghostDark"}
                  icon={Keyboard}
                  onPress={() => router.push({ pathname: "/log/type", params: logParams() })}
                >
                  Type
                </Button>
              </View>
            </View>
          </Card>
        )}

        {/* Logged meals grouped by meal, in day order; empty meals take no space. */}
        {MEAL_TYPES.map((t) => {
          const meals = day.meals.filter((m) => m.mealType === t);
          if (meals.length === 0) return null;
          const kcal = meals.reduce((sum, m) => sum + (m.status === "CONFIRMED" ? m.totalKcal : 0), 0);
          return (
            <View key={t} style={{ gap: 8 }}>
              <View style={styles.sectionHead}>
                <Text weight={600}>{MEAL_LABEL[t]}</Text>
                <Text weight={600} size={13} color={c.ink3} tabular>
                  {formatInt(kcal)} kcal
                </Text>
              </View>
              {meals.map((m) => (
                <MealRow
                  key={m.id}
                  onPress={() => router.push(`/log/${m.id}`)}
                  photoUrl={m.photoUrl}
                  meta={`${MEAL_LABEL[m.mealType]} · ${formatTime(m.createdAt, day.timezone)}`}
                  title={mealTitle(
                    m.items.map((i) => i.name),
                    m.source === "TEXT" ? (m.inputText ?? "Typed meal") : "Photo",
                  )}
                  kcal={m.totalKcal}
                  status={m.status}
                />
              ))}
            </View>
          );
        })}

        {day.meals.length > 0 && (
          <Button variant="dashed" icon={Plus} onPress={() => router.push({ pathname: logPath, params: logParams() })}>
            Log food
          </Button>
        )}
      </View>
    </>
  );
}

/**
 * ‹ Today › — step back up to a week to see a day and add a meal you forgot to log (or swipe the
 * cards below). Older days are in Past logs; the API won't take meals further back. Fixed height:
 * the second line is always there (a swipe hint today, "Back to today" on a past day), so nothing
 * below moves when the day changes.
 */
function DaySwitcher({
  day,
  canOlder,
  canNewer,
  onOlder,
  onNewer,
  onToday,
}: {
  day: string;
  canOlder: boolean;
  canNewer: boolean;
  onOlder: () => void;
  onNewer: () => void;
  onToday: () => void;
}) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.switcher} accessibilityLabel="Choose a day">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Previous day"
        accessibilityState={{ disabled: !canOlder }}
        disabled={!canOlder}
        onPress={onOlder}
        hitSlop={8}
        style={({ pressed }) => [
          styles.switchBtn,
          pressed && { backgroundColor: c.sunken },
          !canOlder && { opacity: 0.3 },
        ]}
      >
        <ChevronLeft size={20} color={c.ink} />
      </Pressable>
      <View style={styles.switchMid}>
        <Text weight={600} accessibilityLiveRegion="polite" numberOfLines={1}>
          {dayLabel(day)}
        </Text>
        {canNewer ? (
          <Pressable accessibilityRole="button" onPress={onToday} hitSlop={10}>
            <Text weight={600} size={12} color={c.brandText} style={styles.switchSub}>
              Back to today
            </Text>
          </Pressable>
        ) : (
          <Text size={12} color={c.ink3} style={styles.switchSub}>
            Swipe for earlier days
          </Text>
        )}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Next day"
        accessibilityState={{ disabled: !canNewer }}
        disabled={!canNewer}
        onPress={onNewer}
        hitSlop={8}
        style={({ pressed }) => [
          styles.switchBtn,
          pressed && { backgroundColor: c.sunken },
          !canNewer && { opacity: 0.3 },
        ]}
      >
        <ChevronRight size={20} color={c.ink} />
      </Pressable>
    </View>
  );
}

/**
 * Where the weight is heading: latest weigh-in, this week's change vs the plan and days logged,
 * one tap into the full Progress screen (weekly check-in, trend chart).
 */
function ProgressCard({ p }: { p: ProgressDto }) {
  const c = useColors();
  const styles = useStyles();
  const latest = p.latest?.weightKg ?? null;
  const change = p.weeklyChange;
  const planned = p.plan.weeklyChangeKg;
  const onTrack = change != null && Math.abs(change - planned) <= 0.25;
  const Trend = change != null && change > 0 ? TrendingUp : TrendingDown;
  const kg = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n).toFixed(1)} kg`;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityHint="Opens Progress: weekly check-in and weight trend"
      onPress={() => router.push("/progress")}
      style={({ pressed }) => [styles.progress, pressed && { backgroundColor: c.sunken }]}
    >
      <View style={styles.progressRow}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="meta">Latest weight</Text>
          <Text variant="h2" size={24} tabular>
            {latest != null ? `${latest.toFixed(1)} kg` : "—"}
          </Text>
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <Text variant="meta">This week</Text>
          {change != null ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
              <Trend size={16} color={onTrack ? c.protein : c.cautionText} />
              <Text weight={700} size={17} color={onTrack ? c.protein : c.cautionText} tabular>
                {kg(change)}
              </Text>
            </View>
          ) : (
            <Text weight={600} size={15} color={c.ink3}>
              Not enough data
            </Text>
          )}
        </View>
        <ChevronRight size={20} color={c.ink3} />
      </View>
      <View style={styles.divider} />
      <Text size={13} color={c.ink2}>
        {change == null
          ? "Weigh in once a week to see your trend against the plan."
          : onTrack
            ? `On track with the plan (${kg(planned)} a week). Logged ${p.daysLogged}/7 days.`
            : `Plan is ${kg(planned)} a week. Logged ${p.daysLogged}/7 days.`}
      </Text>
      <Text weight={600} size={13} color={c.brandText}>
        Weekly check-in and trend
      </Text>
    </Pressable>
  );
}

const useStyles = makeStyles((c) => ({
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  switcher: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    height: 60,
    borderRadius: radius.card,
    backgroundColor: c.surface,
    paddingHorizontal: 6,
  },
  switchBtn: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  switchMid: { flex: 1, alignItems: "center", justifyContent: "center", height: 44 },
  switchSub: { lineHeight: 16, height: 16 },
  streak: {
    marginTop: 4,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    backgroundColor: c.surface,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  divider: { height: 1, backgroundColor: c.line },
  sectionHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  pastLogs: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: c.brandSoft,
  },
  progress: { borderRadius: radius.card, backgroundColor: c.surface, padding: 16, gap: 12 },
  progressRow: { flexDirection: "row", alignItems: "center", gap: 12 },
}));
