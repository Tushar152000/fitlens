import type { ReactNode } from "react";
import { StyleSheet, View, type DimensionValue } from "react-native";
import { Skeleton, type SkeletonTone } from "@/components/ui/skeleton";
import { colors, radius } from "@/lib/theme";

/**
 * Loading layouts shaped like each screen's real content (design: "skeleton blocks in sunken,
 * same shapes as the content"). Blocks on the page use the ground tone; inside cards, the card tone.
 */

export function Line({ width = "100%", height = 14, tone = "ground" }: { width?: DimensionValue; height?: number; tone?: SkeletonTone }) {
  return <Skeleton height={height} width={width} radius={height / 2} tone={tone} />;
}

function Box({ children, dark, style }: { children: ReactNode; dark?: boolean; style?: object }) {
  return <View style={[styles.card, dark && { backgroundColor: colors.ink }, style]}>{children}</View>;
}

/** Page title block: small meta line over a display heading. */
export function TitleSkeleton({ width = "65%" }: { width?: DimensionValue }) {
  return (
    <View style={{ gap: 10 }}>
      <Line width={110} height={12} />
      <Line width={width} height={28} />
    </View>
  );
}

export function MealRowSkeleton() {
  return (
    <Box style={styles.mealRow}>
      <Skeleton height={48} width={48} radius={12} tone="card" />
      <View style={{ flex: 1, gap: 8 }}>
        <Line width="35%" height={11} tone="card" />
        <Line width="70%" height={15} tone="card" />
      </View>
      <Line width={56} height={16} tone="card" />
    </Box>
  );
}

/** Screen 6: ring + macro bars card, meal rows, workout card. */
export function TodaySkeleton() {
  return (
    <>
      <Box style={{ gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 20 }}>
          <Skeleton height={148} width={148} radius={74} tone="card" />
          <View style={{ flex: 1, gap: 16 }}>
            {[0, 1, 2, 3].map((i) => (
              <View key={i} style={{ gap: 8 }}>
                <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <Line width="40%" height={12} tone="card" />
                  <Line width="30%" height={12} tone="card" />
                </View>
                <Line height={8} tone="card" />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.divider} />
        <Line width="55%" height={12} tone="card" />
        <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
          <Line width="35%" height={12} tone="card" />
          <View style={{ flex: 1 }} />
          <Skeleton height={32} width={70} radius={16} tone="card" />
          <Skeleton height={32} width={70} radius={16} tone="card" />
        </View>
      </Box>
      <View style={{ gap: 10 }}>
        <Line width={90} height={20} />
        <MealRowSkeleton />
        <MealRowSkeleton />
        <Skeleton height={48} radius={radius.button} />
      </View>
    </>
  );
}

/** The dark workout card on Today. */
export function WorkoutCardSkeleton() {
  return (
    <Box dark style={styles.mealRow}>
      <Skeleton height={48} width={48} radius={12} tone="dark" />
      <View style={{ flex: 1, gap: 8 }}>
        <Line width="25%" height={11} tone="dark" />
        <Line width="50%" height={15} tone="dark" />
        <Line width="80%" height={12} tone="dark" />
      </View>
    </Box>
  );
}

/** Screen 10a. */
export function BriefingSkeleton() {
  return (
    <>
      <TitleSkeleton width="75%" />
      <Skeleton height={76} />
      <View style={{ gap: 8 }}>
        <Line width={130} height={12} />
        <Skeleton height={52} radius={radius.input} />
      </View>
      <Box dark style={{ gap: 14, padding: 20 }}>
        <Line width="55%" height={12} tone="dark" />
        {[0, 1].map((i) => (
          <View key={i} style={{ gap: 8 }}>
            <Line width="70%" height={15} tone="dark" />
            <Line width="95%" height={12} tone="dark" />
          </View>
        ))}
      </Box>
      <ListSkeleton rows={5} />
    </>
  );
}

/** A white card of rows: name + meta on the left, figures on the right. */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <Box style={{ padding: 0, gap: 0 }}>
      {Array.from({ length: rows }, (_, i) => (
        <View key={i} style={[styles.listRow, i > 0 && styles.rowLine]}>
          <View style={{ flex: 1, gap: 8 }}>
            <Line width="60%" height={15} tone="card" />
            <Line width="40%" height={11} tone="card" />
          </View>
          <View style={{ alignItems: "flex-end", gap: 8, width: 70 }}>
            <Line width={60} height={15} tone="card" />
            <Line width={40} height={11} tone="card" />
          </View>
        </View>
      ))}
    </Box>
  );
}

/** Screen 10. */
export function WorkoutSkeleton() {
  return (
    <>
      <TitleSkeleton width="45%" />
      <View style={{ flexDirection: "row", gap: 6 }}>
        {Array.from({ length: 7 }, (_, i) => (
          <View key={i} style={{ flex: 1 }}>
            <Skeleton height={56} radius={radius.input} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: "row", gap: 8 }}>
        <Skeleton height={36} width={96} radius={18} />
        <Skeleton height={36} width={120} radius={18} />
      </View>
      <Box style={{ gap: 14 }}>
        <Line width="40%" height={11} tone="card" />
        <Line width="70%" height={22} tone="card" />
        <Line width="85%" height={12} tone="card" />
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
            <Line width={20} height={14} tone="card" />
            <View style={{ flex: 1 }}>
              <Skeleton height={44} radius={radius.input} tone="card" />
            </View>
            <View style={{ flex: 1 }}>
              <Skeleton height={44} radius={radius.input} tone="card" />
            </View>
            <Skeleton height={44} width={44} radius={radius.input} tone="card" />
          </View>
        ))}
      </Box>
    </>
  );
}

function TileSkeleton() {
  return (
    <Box style={{ flex: 1, padding: 12, gap: 8 }}>
      <Line width="70%" height={11} tone="card" />
      <Line width="50%" height={20} tone="card" />
      <Line width="60%" height={10} tone="card" />
    </Box>
  );
}

export function TilesSkeleton({ count = 3 }: { count?: number }) {
  return (
    <View style={{ flexDirection: "row", gap: 8 }}>
      {Array.from({ length: count }, (_, i) => (
        <TileSkeleton key={i} />
      ))}
    </View>
  );
}

/** Screen 11: check-in form, insight, chart, tiles. */
export function ProgressSkeleton() {
  return (
    <>
      <Box style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", gap: 12 }}>
          {[0, 1].map((i) => (
            <View key={i} style={{ flex: 1, gap: 8 }}>
              <Line width="50%" height={12} tone="card" />
              <Skeleton height={52} radius={radius.input} tone="card" />
            </View>
          ))}
        </View>
        <Line width="80%" height={12} tone="card" />
        <Skeleton height={54} radius={radius.button} tone="card" />
      </Box>
      <Skeleton height={88} />
      <Box style={{ gap: 14 }}>
        <Line width="45%" height={18} tone="card" />
        <Skeleton height={170} radius={12} tone="card" />
      </Box>
      <TilesSkeleton />
    </>
  );
}

const BAR_HEIGHTS = [60, 95, 40, 120, 80, 105, 70];

/** Screen 12: summary tiles, the bar chart, the day's meals. */
export function HistorySkeleton() {
  return (
    <>
      <TilesSkeleton count={2} />
      <Box style={{ gap: 12 }}>
        <View style={{ height: 150, flexDirection: "row", alignItems: "flex-end", gap: 12 }}>
          {BAR_HEIGHTS.map((h, i) => (
            <View key={i} style={{ flex: 1 }}>
              <Skeleton height={h} radius={6} tone="card" />
            </View>
          ))}
        </View>
        <Line width="70%" height={11} tone="card" />
      </Box>
      <View style={{ gap: 10 }}>
        <Line width={120} height={20} />
        <MealRowSkeleton />
        <MealRowSkeleton />
      </View>
    </>
  );
}

/** Screen 13's dark goal card. */
export function GoalCardSkeleton() {
  return (
    <Box dark style={{ gap: 12, padding: 20 }}>
      <Line width="30%" height={12} tone="dark" />
      <Line width="50%" height={24} tone="dark" />
      <Line width="65%" height={12} tone="dark" />
      <View style={[styles.divider, { backgroundColor: "rgba(255,255,255,0.15)" }]} />
      <Line width="85%" height={12} tone="dark" />
    </Box>
  );
}

/** Screen 9 while the meal loads: header line, then item cards. */
export function MealSkeleton() {
  return (
    <>
      <Line width="60%" height={26} />
      <Line width="45%" height={12} />
      {[0, 1, 2].map((i) => (
        <Box key={i} style={{ gap: 14 }}>
          <Line width="45%" height={16} tone="card" />
          <Line width="30%" height={12} tone="card" />
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton height={44} width={128} radius={radius.input} tone="card" />
            <Line width={64} height={16} tone="card" />
          </View>
        </Box>
      ))}
    </>
  );
}

/** Screen 7d / 7g: product header, amount card, nutrition table. */
export function ProductSkeleton() {
  return (
    <>
      <Skeleton height={26} width={150} radius={13} />
      <View style={{ flexDirection: "row", gap: 16 }}>
        <Skeleton height={80} width={80} radius={20} />
        <View style={{ flex: 1, gap: 10 }}>
          <Line width="35%" height={12} />
          <Line width="80%" height={22} />
          <Line width="55%" height={12} />
        </View>
      </View>
      <Box style={{ gap: 12 }}>
        <Skeleton height={52} radius={radius.input} tone="card" />
        <Skeleton height={44} width={140} radius={radius.input} tone="card" />
      </Box>
      <ListSkeleton rows={5} />
    </>
  );
}

/** Screen 5: plan cards. */
export function PlanSkeleton() {
  return (
    <>
      <Line width="45%" height={28} />
      <Skeleton height={26} width={140} radius={13} />
      <Box style={{ gap: 14 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Line width={70} height={26} tone="card" />
          <Line width={90} height={26} tone="card" />
        </View>
        <Skeleton height={64} radius={12} tone="card" />
        <Line width="40%" height={12} tone="card" />
      </Box>
      <GoalCardSkeleton />
      <TilesSkeleton />
    </>
  );
}

/** Onboarding while an existing profile loads (editing the goal). */
export function FormSkeleton() {
  return (
    <>
      <Line width="50%" height={28} />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} height={60} radius={radius.input} />
      ))}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ flex: 1 }}>
            <Skeleton height={76} radius={radius.input} />
          </View>
        ))}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 12 },
  mealRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, minHeight: 64 },
  divider: { height: 1, backgroundColor: colors.line },
  listRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
});
