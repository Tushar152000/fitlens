import { LinearGradient } from "expo-linear-gradient";
import { NATIVE_DRIVER } from "@/lib/motion";
import { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  View,
  type DimensionValue,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { colors } from "@/lib/theme";

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

/** Base colour per surface: the page ground, a white card, or a dark (ink) card. */
const TONES = {
  ground: { base: colors.chip, shine: "rgba(255,255,255,0.7)" },
  card: { base: colors.sunken, shine: "rgba(255,255,255,0.9)" },
  dark: { base: "rgba(255,255,255,0.10)", shine: "rgba(255,255,255,0.14)" },
} as const;

export type SkeletonTone = keyof typeof TONES;

/**
 * Loading block shaped like the content it stands in for, with a light sweep across it
 * (design: skeletons in `sunken`, never a spinner alone). Honours Reduce Motion.
 */
export function Skeleton({
  height,
  width = "100%",
  radius = 20,
  tone = "ground",
  style,
}: {
  height: number;
  width?: DimensionValue;
  radius?: number;
  tone?: SkeletonTone;
  style?: StyleProp<ViewStyle>;
}) {
  const reduce = useReduceMotion();
  const [w, setW] = useState(0);
  const [sweep] = useState(() => new Animated.Value(0));
  const t = TONES[tone];

  // Blocks mount together, so their sweeps stay in step without sharing one animation.
  useEffect(() => {
    if (reduce) return;
    const loop = Animated.loop(
      Animated.timing(sweep, { toValue: 1, duration: 1300, easing: Easing.inOut(Easing.ease), useNativeDriver: NATIVE_DRIVER }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduce, sweep]);

  const band = Math.max(80, w * 0.6);
  return (
    <View
      aria-hidden
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={[{ height, width, borderRadius: radius, backgroundColor: t.base, overflow: "hidden" }, style]}
    >
      {!reduce && w > 0 && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            { width: band, transform: [{ translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [-band, w] }) }] },
          ]}
        >
          <LinearGradient
            colors={["rgba(255,255,255,0)", t.shine, "rgba(255,255,255,0)"]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}
