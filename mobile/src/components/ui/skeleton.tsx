import { useEffect, useState } from "react";
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { colors } from "@/lib/theme";

/** Loading block in `sunken`, shaped like the content it stands in for. Never a spinner alone. */
export function Skeleton({
  height,
  width = "100%",
  radius = 20,
  style,
}: {
  height: number;
  width?: DimensionValue;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const [opacity] = useState(() => new Animated.Value(1));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      aria-hidden
      style={[{ height, width, borderRadius: radius, backgroundColor: colors.sunken, opacity }, style]}
    />
  );
}
