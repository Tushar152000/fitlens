import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewProps,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useColors, gutter as defaultGutter } from "@/lib/theme";

/**
 * Scrolling screen on the ground colour with the app gutter. `footer` is pinned to the bottom
 * (the one primary action), above the tab bar when the screen has one, and rides up with the
 * keyboard so inputs in it stay visible. Padding on both platforms: the app is edge-to-edge on
 * Android, where the window no longer resizes for the keyboard.
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
  const c = useColors();
  const styles = useStyles();
  const bottom = tabBar ? 0 : insets.bottom;
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.root, dark && { backgroundColor: c.panel }]}>
      <ScrollView
        contentContainerStyle={[
          { paddingTop: insets.top + 16, paddingHorizontal: gutter, paddingBottom: footer ? 16 : bottom + 32, gap: 24 },
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={c.ink3} />
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
            dark && { backgroundColor: c.panel, borderTopColor: "rgba(255,255,255,0.1)" },
          ]}
        >
          {footer}
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((c) => ({
  root: { flex: 1, backgroundColor: c.ground },
  footer: {
    paddingTop: 12,
    gap: 10,
    backgroundColor: c.ground,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.line,
  },
}));

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
  const cardStyles = useCardStyles();
  return (
    <View {...props} style={[cardStyles.card, dark && cardStyles.dark, style]}>
      {children}
    </View>
  );
}

const useCardStyles = makeStyles((c) => ({
  card: { backgroundColor: c.surface, borderRadius: 20, padding: 16, gap: 12 },
  dark: { backgroundColor: c.panel, borderWidth: StyleSheet.hairlineWidth, borderColor: c.panelLine },
}));
