import { Platform } from "react-native";

/**
 * Use the native animation driver on phones. The web preview has none, and there
 * `Animated.loop` with the native driver runs only once.
 */
export const NATIVE_DRIVER = Platform.OS !== "web";
