import type { ReactNode } from "react";
import { RefreshControl, ScrollView, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, gutter as defaultGutter } from "@/lib/theme";

/**
 * Scrolling screen on the ground colour with the app gutter. `footer` is pinned to the bottom
 * (the one primary action), above the tab bar when the screen has one.
 */
export function Screen({
  children,
  footer,
  gutter = defaultGutter,
  refreshing,
  onRefresh,
  dark,
  contentStyle,
  tabBar,
}: {
  children: ReactNode;
  footer?: ReactNode;
  gutter?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  dark?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  /** True inside the tabs: the tab bar already covers the bottom safe area. */
  tabBar?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const bottom = tabBar ? 0 : insets.bottom;
  return (
    <View style={[styles.root, dark && { backgroundColor: colors.ink }]}>
      <ScrollView
        contentContainerStyle={[
          { paddingTop: insets.top + 16, paddingHorizontal: gutter, paddingBottom: footer ? 16 : bottom + 32, gap: 24 },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={colors.ink3} />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
      {footer && (
        <View
          style={[
            styles.footer,
            { paddingHorizontal: gutter, paddingBottom: Math.max(16, bottom) },
            dark && { backgroundColor: colors.ink, borderTopColor: "rgba(255,255,255,0.1)" },
          ]}
        >
          {footer}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  footer: {
    paddingTop: 12,
    gap: 10,
    backgroundColor: colors.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
  },
});

/** A white card with the standard radius and padding. */
export function Card({
  children,
  style,
  dark,
  ...props
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  dark?: boolean;
} & Omit<ViewProps, "style">) {
  return (
    <View {...props} style={[cardStyles.card, dark && cardStyles.dark, style]}>
      {children}
    </View>
  );
}

const cardStyles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, gap: 12 },
  dark: { backgroundColor: colors.ink },
});
