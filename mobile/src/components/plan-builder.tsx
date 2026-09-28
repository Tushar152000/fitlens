import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Circle } from "react-native-svg";
import { Text } from "@/components/ui";
import { NATIVE_DRIVER } from "@/lib/motion";
import { colors } from "@/lib/theme";

const STEPS = ["Reading your body stats", "Setting calories and macros", "Planning your training week"];
const STEP_MS = 850;
const SIZE = 200;
const R = 92;
const CIRC = 2 * Math.PI * R;

/**
 * Full-screen "Building your plan" moment after onboarding: a coach avatar pressing dumbbells
 * inside a filling ring, with a 3-step checklist. Steps advance on a timer; the last one
 * completes when `done` is true. Still (no loop) under Reduce Motion.
 */
export function PlanBuilder({ done }: { done: boolean }) {
  const reduce = useReduceMotion();
  const [press] = useState(() => new Animated.Value(0));
  const [ring] = useState(() => new Animated.Value(0));
  const [step, setStep] = useState(0);

  // Steps 1 and 2 tick on a timer; step 3 waits for the plan to be saved.
  useEffect(() => {
    const t1 = setTimeout(() => setStep((s) => Math.max(s, 1)), STEP_MS);
    const t2 = setTimeout(() => setStep((s) => Math.max(s, 2)), STEP_MS * 2);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);
  const active = done ? 3 : step;

  const [fill, setFill] = useState(0);
  useEffect(() => {
    const id = ring.addListener(({ value }) => setFill(value));
    Animated.timing(ring, {
      toValue: active / 3,
      duration: 420,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // drives an SVG prop through state
    }).start();
    return () => ring.removeListener(id);
  }, [active, ring]);

  useEffect(() => {
    if (reduce) {
      press.setValue(0.5);
      return;
    }
    const ease = Easing.inOut(Easing.quad);
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(press, { toValue: 1, duration: 650, easing: ease, useNativeDriver: NATIVE_DRIVER }),
        Animated.delay(120),
        Animated.timing(press, { toValue: 0, duration: 650, easing: ease, useNativeDriver: NATIVE_DRIVER }),
        Animated.delay(80),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [press, reduce]);

  const leftArm = press.interpolate({ inputRange: [0, 1], outputRange: ["20deg", "160deg"] });
  const rightArm = press.interpolate({ inputRange: [0, 1], outputRange: ["-20deg", "-160deg"] });
  const bob = press.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  return (
    <View style={styles.root} accessibilityLiveRegion="polite" accessibilityLabel="Building your plan">
      <View style={{ width: SIZE, height: SIZE }}>
        <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ transform: [{ rotate: "-90deg" }] }}>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill={colors.surface} stroke={colors.track} strokeWidth={10} />
          {fill > 0.001 && (
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={R}
              fill="none"
              stroke={colors.brand}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={`${CIRC} ${CIRC}`}
              strokeDashoffset={CIRC * (1 - fill)}
            />
          )}
        </Svg>

        {/* The coach: arms press the dumbbells overhead and back while the body bobs. */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ translateY: bob }] }]} aria-hidden>
          <Animated.View style={[styles.arm, { left: 66, transform: [{ rotate: leftArm }] }]}>
            <Dumbbell />
          </Animated.View>
          <Animated.View style={[styles.arm, { left: 122, transform: [{ rotate: rightArm }] }]}>
            <Dumbbell />
          </Animated.View>
          <View style={styles.head}>
            <View style={styles.hair} />
            <View style={[styles.eye, { left: 13 }]} />
            <View style={[styles.eye, { right: 13 }]} />
            <View style={styles.smile} />
          </View>
          <View style={styles.torso}>
            <View style={styles.logoDot} />
          </View>
          <View style={[styles.leg, { left: 80 }]} />
          <View style={[styles.leg, { left: 104 }]} />
        </Animated.View>
      </View>

      <View style={{ alignItems: "center", gap: 4 }}>
        <Text variant="h1" center>
          {done ? "Your plan is ready" : "Building your plan…"}
        </Text>
        <Text color={colors.ink2} center>
          {done ? "Here's what your coach set up." : "Your coach is warming up."}
        </Text>
      </View>

      <View style={{ gap: 12, alignSelf: "stretch", paddingHorizontal: 12 }}>
        {STEPS.map((label, i) => {
          const complete = i < active;
          const current = i === active;
          return (
            <View
              key={label}
              style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              accessibilityLabel={`${label}${complete ? " — done" : current ? " — in progress" : ""}`}
            >
              <View
                style={[
                  styles.tick,
                  complete
                    ? { backgroundColor: colors.protein }
                    : { borderWidth: 2, borderColor: current ? colors.brand : colors.lineStrong },
                ]}
              >
                {complete && <Check size={14} color={colors.white} strokeWidth={3} />}
                {current && <View style={styles.dot} />}
              </View>
              <Text weight={current ? 600 : 400} color={complete ? colors.ink2 : current ? colors.ink : colors.ink3}>
                {label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Held at the hand end of each arm, so it swings up with it. */
function Dumbbell() {
  return (
    <View style={styles.dumbbell}>
      <View style={styles.plate} />
      <View style={styles.bar} />
      <View style={styles.plate} />
    </View>
  );
}

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

const SKIN = "#E9C58E";

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 50,
    backgroundColor: colors.ground,
    alignItems: "center",
    justifyContent: "center",
    gap: 28,
    paddingHorizontal: 32,
  },
  head: {
    position: "absolute",
    top: 34,
    left: 78,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: SKIN,
    overflow: "hidden",
  },
  hair: { position: "absolute", top: 0, left: 0, right: 0, height: 12, backgroundColor: colors.ink },
  eye: { position: "absolute", top: 20, width: 5, height: 5, borderRadius: 3, backgroundColor: colors.ink },
  smile: {
    position: "absolute",
    top: 27,
    left: 15,
    width: 14,
    height: 7,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 2,
    borderTopWidth: 0,
    borderColor: colors.ink,
  },
  torso: {
    position: "absolute",
    top: 82,
    left: 72,
    width: 56,
    height: 62,
    borderRadius: 20,
    backgroundColor: colors.brand,
    alignItems: "center",
    paddingTop: 14,
  },
  logoDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.ground },
  leg: { position: "absolute", top: 138, width: 16, height: 30, borderRadius: 8, backgroundColor: colors.ink },
  arm: {
    position: "absolute",
    top: 90,
    width: 12,
    height: 42,
    borderRadius: 6,
    backgroundColor: SKIN,
    transformOrigin: "top",
    alignItems: "center",
    justifyContent: "flex-end",
  },
  dumbbell: { flexDirection: "row", alignItems: "center", marginBottom: -9 },
  plate: { width: 8, height: 20, borderRadius: 3, backgroundColor: colors.brandGlow },
  bar: { width: 14, height: 5, backgroundColor: colors.ink },
  tick: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand },
});
