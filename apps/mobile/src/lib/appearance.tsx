import * as SecureStore from "expo-secure-store";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Appearance, Platform, StyleSheet, useColorScheme } from "react-native";
import { palettes, shadowsFor, type Colors, type ColorScheme, type Shadows } from "./palette";

/** "system" follows the phone; light/dark pin the app regardless of the phone setting. */
export type AppearancePreference = "system" | "light" | "dark";

const KEY = "fitr8.appearance";
const PREFS: AppearancePreference[] = ["system", "light", "dark"];

/** Read synchronously at start so the first frame is already in the right scheme (no flash). */
function readPreference(): AppearancePreference {
  try {
    const raw = Platform.OS === "web" ? globalThis.localStorage?.getItem(KEY) : SecureStore.getItem(KEY);
    return PREFS.includes(raw as AppearancePreference) ? (raw as AppearancePreference) : "system";
  } catch {
    return "system";
  }
}

function writePreference(pref: AppearancePreference) {
  try {
    if (Platform.OS === "web") globalThis.localStorage?.setItem(KEY, pref);
    else SecureStore.setItem(KEY, pref);
  } catch {
    // Not saved: the choice still applies until the app restarts.
  }
}

/** Native views (alerts, date pickers, keyboard) follow the app's choice, not just our own views. */
function applyNative(pref: AppearancePreference) {
  if (Platform.OS === "web") return;
  Appearance.setColorScheme(pref === "system" ? "unspecified" : pref);
}

const initial = readPreference();
applyNative(initial);

interface AppearanceValue {
  preference: AppearancePreference;
  scheme: ColorScheme;
  setPreference: (pref: AppearancePreference) => void;
}

const Ctx = createContext<AppearanceValue>({ preference: "system", scheme: "light", setPreference: () => {} });

/** Wrap the app once (root layout). Also sets the status bar and the native root background. */
export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setPref] = useState<AppearancePreference>(initial);
  const system = useColorScheme();
  const scheme: ColorScheme = preference === "system" ? (system === "dark" ? "dark" : "light") : preference;

  useEffect(() => {
    // The window behind every screen: no white flash on transitions, keyboard or modal open.
    SystemUI.setBackgroundColorAsync(palettes[scheme].ground).catch(() => {});
  }, [scheme]);

  const setPreference = (pref: AppearancePreference) => {
    writePreference(pref);
    applyNative(pref);
    setPref(pref);
  };

  return (
    <Ctx.Provider value={{ preference, scheme, setPreference }}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      {children}
    </Ctx.Provider>
  );
}

export const useAppearance = () => useContext(Ctx);
export const useScheme = (): ColorScheme => useContext(Ctx).scheme;
/** The active palette. Use for inline colours (icon `color`, `Text color`, conditional styles). */
export const useColors = (): Colors => palettes[useScheme()];
export const useShadows = (): Shadows => shadowsFor(useScheme());

/**
 * `StyleSheet.create` for the active scheme: define styles from the palette once per scheme, then
 * call the returned hook inside the component.
 *
 *   const useStyles = makeStyles((c) => ({ card: { backgroundColor: c.surface } }));
 *   function Card() { const styles = useStyles(); ... }
 */
export function makeStyles<T extends StyleSheet.NamedStyles<T> | StyleSheet.NamedStyles<any>>(
  build: (c: Colors, shadows: Shadows) => T & StyleSheet.NamedStyles<any>,
): () => T {
  const cache: Partial<Record<ColorScheme, T>> = {};
  return function useStyles() {
    const scheme = useScheme();
    return (cache[scheme] ??= StyleSheet.create(build(palettes[scheme], shadowsFor(scheme))));
  };
}
