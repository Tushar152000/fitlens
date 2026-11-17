import { useEffect, useMemo, type ReactNode } from "react";
import { Platform, useWindowDimensions, View } from "react-native";
import { Gesture } from "react-native-gesture-handler";
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

/** Settling after a swipe, and the slide when an arrow is tapped (a touch slower, it wasn't dragged). */
const SWIPE_MS = 320;
const ARROW_MS = 420;
const EASE = Easing.out(Easing.cubic);
/** A swipe pages past a fifth of the screen, or on a light flick. */
const SWIPE_FRACTION = 0.2;
const SWIPE_VELOCITY = 400;
/** Days kept rendered (and so loaded) either side of the current one: a 5-day window. */
export const DAY_WINDOW_RADIUS = 2;
/** Pull past the first/last day: the strip moves this fraction of the finger, then settles back. */
const EDGE_RESISTANCE = 0.2;

/**
 * Web only: a mouse drag that starts on a button ends in a click on it, so a swipe that began on
 * "Snap" would also open the camera. Phones don't need this (gesture-handler cancels the press when
 * the pan activates). Swallow the click that lands right after a swipe ends.
 */
let swipeEndedAt = 0;
const markSwipeEnded = () => {
  swipeEndedAt = Date.now();
};
if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener(
    "click",
    (e) => {
      if (Date.now() - swipeEndedAt < 350) {
        e.stopPropagation();
        e.preventDefault();
      }
    },
    true,
  );
}

/**
 * Today's days as a horizontal pager, like an app drawer: the day before sits one screen to the
 * left, the day after one screen to the right. Dragging moves the whole strip with the finger, so
 * the neighbour slides in alongside; letting go settles on a page. The arrows slide the same strip.
 *
 * Pages are keyed by date and placed by their position in `days`, so changing the index never
 * swaps content under the user: nothing blinks. The current page sits in normal flow (it gives the
 * strip its height); neighbours are absolutely placed and off screen until dragged in.
 *
 * `days` is newest first (index 0 = today). Wrap the whole screen in a GestureDetector with
 * `gesture` so a swipe anywhere pages. `onIndex` must be stable (useCallback): the gesture is
 * built once per `onIndex`.
 */
export function useDayPager({
  days,
  index,
  onIndex,
}: {
  days: string[];
  index: number;
  onIndex: (index: number) => void;
}) {
  const { width } = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  // Strip offset: page i is at -i * width, so showing page `index` means tx = index * width.
  // Shared values via .get()/.set(): what React Compiler (on in this app) can track.
  const tx = useSharedValue(index * width);
  const start = useSharedValue(index * width);
  const settledAt = useSharedValue(index * width);
  // What the gesture reads, kept live so the gesture itself is created once (below).
  const current = useSharedValue(index);
  const pageWidth = useSharedValue(width);
  const lastIndex = useSharedValue(days.length - 1);
  useEffect(() => {
    current.set(index);
    pageWidth.set(width);
    lastIndex.set(days.length - 1);
  }, [index, width, days.length, current, pageWidth, lastIndex]);

  // Index changed (arrow, "Back to today", or rotation). A swipe has already animated there.
  useEffect(() => {
    const to = index * width;
    if (settledAt.get() === to) return;
    settledAt.set(to);
    tx.set(reduceMotion ? to : withTiming(to, { duration: ARROW_MS, easing: EASE }));
  }, [index, width, reduceMotion, tx, settledAt]);

  // Created ONCE. Rebuilding the gesture on every render made gesture-handler re-attach its
  // listeners, sometimes mid-touch; on web the duplicate pointer-up then threw "Invalid pointer id".
  // Horizontal only: vertical drags stay with the page scroll, taps stay with buttons.
  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-12, 12])
        .failOffsetY([-12, 12])
        .onStart(() => {
          start.set(tx.get());
        })
        .onUpdate((e) => {
          const w = pageWidth.get();
          const base = current.get() * w;
          const next = start.get() + e.translationX;
          const max = lastIndex.get() * w;
          // Beyond the newest (below 0) or oldest page, resist; else follow the finger, one page max.
          if (next < 0) tx.set(next * EDGE_RESISTANCE);
          else if (next > max) tx.set(max + (next - max) * EDGE_RESISTANCE);
          else tx.set(Math.max(base - w, Math.min(base + w, next)));
        })
        .onEnd((e) => {
          const w = pageWidth.get();
          const from = current.get();
          const moved = tx.get() - from * w;
          let to = from;
          // Finger moving right (positive) brings the older day in: a higher index.
          if ((moved > w * SWIPE_FRACTION || e.velocityX > SWIPE_VELOCITY) && from < lastIndex.get()) to = from + 1;
          else if ((moved < -w * SWIPE_FRACTION || e.velocityX < -SWIPE_VELOCITY) && from > 0) to = from - 1;
          const target = to * w;
          settledAt.set(target);
          current.set(to); // a second quick swipe starts from here, before React catches up
          tx.set(withTiming(target, { duration: SWIPE_MS, easing: EASE }));
          scheduleOnRN(markSwipeEnded);
          if (to !== from) scheduleOnRN(onIndex, to);
        }),
    [start, tx, pageWidth, current, lastIndex, settledAt, onIndex],
  );

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.get() }] }));

  return { gesture, stripStyle, width };
}

/**
 * The strip: a 5-day window, the current day and two either side. `renderDay(date, current)`
 * draws one page; off-screen pages are rendered too, so their data is loaded and laid out before
 * they're swiped in (a fast double swipe never lands on a loading day).
 */
export function DayStrip({
  pager,
  days,
  index,
  renderDay,
}: {
  pager: ReturnType<typeof useDayPager>;
  days: string[];
  index: number;
  renderDay: (date: string, current: boolean) => ReactNode;
}) {
  const pages: number[] = [];
  for (let i = index - DAY_WINDOW_RADIUS; i <= index + DAY_WINDOW_RADIUS; i++) {
    if (i >= 0 && i < days.length) pages.push(i);
  }
  return (
    <Animated.View style={pager.stripStyle}>
      {pages.map((i) => {
        const current = i === index;
        return (
          <View
            key={days[i]}
            // Off-screen pages are hidden from screen readers; the arrows move between days.
            importantForAccessibility={current ? "auto" : "no-hide-descendants"}
            accessibilityElementsHidden={!current}
            style={[
              { gap: 24, transform: [{ translateX: -i * pager.width }], pointerEvents: current ? "auto" : "none" },
              !current && { position: "absolute", top: 0, left: 0, right: 0 },
            ]}
          >
            {renderDay(days[i], current)}
          </View>
        );
      })}
    </Animated.View>
  );
}
