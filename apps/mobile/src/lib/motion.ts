import { Platform } from "react-native";
import { Easing, FadeIn, FadeInDown, FadeInUp, FadeOut, FadeOutUp, SlideInDown } from "react-native-reanimated";

/**
 * Use the native animation driver on phones. The web preview has none, and there
 * `Animated.loop` with the native driver runs only once.
 */
export const NATIVE_DRIVER = Platform.OS !== "web";

/**
 * Motion (docs/DESIGN.md "Motion"): one feel across the app. Screens slide in from the right
 * (Android uses the iOS-style push, which reads smoother than the default zoom); modals rise from
 * the bottom; tab switches cross-fade. Component animations are short and ease out, and follow the
 * phone's "reduce motion" setting (Reanimated's default).
 */
export const stackMotion = {
  animation: Platform.OS === "android" ? ("ios_from_right" as const) : ("default" as const),
  gestureEnabled: true,
  fullScreenGestureEnabled: true,
};

export const modalMotion = {
  presentation: "modal" as const,
  animation: Platform.OS === "android" ? ("slide_from_bottom" as const) : ("default" as const),
};

export const tabMotion = { animation: "fade" as const };

const easeOut = Easing.out(Easing.cubic);

/** Something appearing in place (a banner, a card): a short fade up. */
export const appear = FadeInDown.duration(240).easing(easeOut);
/** Something leaving in place. */
export const disappear = FadeOut.duration(160);
/** Content revealed by a tap (an accordion row). */
export const reveal = FadeIn.duration(180).easing(easeOut);
/** A bottom sheet's panel rising in. */
export const sheetIn = SlideInDown.duration(280).easing(easeOut);
/** A toast dropping in and out at the top. */
export const toastIn = FadeInUp.duration(220).easing(easeOut);
export const toastOut = FadeOutUp.duration(180);
