import {
  BricolageGrotesque_500Medium,
  BricolageGrotesque_600SemiBold,
  BricolageGrotesque_700Bold,
  BricolageGrotesque_800ExtraBold,
} from "@expo-google-fonts/bricolage-grotesque";
import {
  Figtree_400Regular,
  Figtree_500Medium,
  Figtree_600SemiBold,
  Figtree_700Bold,
} from "@expo-google-fonts/figtree";
import { QueryClientProvider } from "@tanstack/react-query";
import { useFonts } from "expo-font";
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import * as WebBrowser from "expo-web-browser";
import { WifiOff } from "lucide-react-native";
import { useEffect, useState, type ReactNode } from "react";
import { View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Text } from "@/components/ui";
import { OfflineBanner } from "@/components/offline-banner";
import { trackScreen } from "@/lib/analytics";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient, wireQueryLifecycle } from "@/lib/query";
import { configureNotifications } from "@/lib/reminders";
import { AppearanceProvider, palettes, useColors, useScheme } from "@/lib/theme";

SplashScreen.preventAutoHideAsync();
// Finishes the sign-in popup when the web preview is used.
WebBrowser.maybeCompleteAuthSession();

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    BricolageGrotesque_500Medium,
    BricolageGrotesque_600SemiBold,
    BricolageGrotesque_700Bold,
    BricolageGrotesque_800ExtraBold,
    Figtree_400Regular,
    Figtree_500Medium,
    Figtree_600SemiBold,
    Figtree_700Bold,
  });
  useEffect(() => wireQueryLifecycle(), []);
  useEffect(() => {
    configureNotifications().catch(() => {});
  }, []);

  return (
    // Gestures (the day swipe on Today) need the handler root at the top of the tree.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <AppearanceProvider>
            <NavigationTheme>
              <AuthProvider>
                {fontsLoaded && <Routes />}
                <OfflineBanner />
              </AuthProvider>
            </NavigationTheme>
          </AppearanceProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

/**
 * React Navigation's own colours (screen card, transitions, modal backdrop) from our palette, so no
 * screen flashes white in dark mode.
 */
function NavigationTheme({ children }: { children: ReactNode }) {
  const scheme = useScheme();
  const c = palettes[scheme];
  const base = scheme === "dark" ? DarkTheme : DefaultTheme;
  const theme = {
    ...base,
    colors: {
      ...base.colors,
      primary: c.brandText,
      background: c.ground,
      card: c.surface,
      text: c.ink,
      border: c.line,
      notification: c.brand,
    },
  };
  return <ThemeProvider value={theme}>{children}</ThemeProvider>;
}

/**
 * Signed out → login; signed in but not onboarded → onboarding only; onboarded but away 90+ days →
 * the welcome-back check-in; otherwise the app. A returning user who signs in again never repeats
 * onboarding.
 */
function Routes() {
  const { status, me } = useAuth();
  const c = useColors();
  // Route pattern (e.g. "log/[id]"), never ids; groups like "(tabs)" dropped.
  const screen = useSegments()
    .filter((s) => !s.startsWith("("))
    .join("/");
  useEffect(() => {
    if (status === "signedIn" || status === "signedOut") trackScreen(screen || "index");
  }, [screen, status]);
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync();
  }, [status]);
  if (status === "loading") return null;
  if (status === "offline") return <OfflineStart />;

  const signedIn = status === "signedIn";
  const onboarded = Boolean(me?.onboarded);
  // Back after 90+ days: only the welcome-back check-in until it's answered or dismissed.
  const welcomeBack = onboarded && Boolean(me?.welcomeBack);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: c.ground } }}>
      {/*
        Order matters: when a guard flips (sign-in, sign-out), the stack falls back to the FIRST screen
        still allowed. The app must come before onboarding, or a returning user who signs in again
        lands on the (prefilled) edit-goal form instead of Today.
      */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && welcomeBack}>
        <Stack.Screen name="welcome-back" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded && !welcomeBack}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log" />
        <Stack.Screen name="briefing" />
        <Stack.Screen name="history" />
        <Stack.Screen name="progress" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="coach-memory" />
        <Stack.Screen name="reminders" />
        <Stack.Screen name="pro" options={{ presentation: "modal" }} />
      </Stack.Protected>
      {/* First-time setup, and where an onboarded user edits their goal (pushed from Profile). */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
    </Stack>
  );
}

/** A saved session but no connection at launch: keep the session and let the user retry. */
function OfflineStart() {
  const { retry } = useAuth();
  const [busy, setBusy] = useState(false);
  const c = useColors();
  return (
    <View style={{ flex: 1, backgroundColor: c.ground, justifyContent: "center", padding: 24, gap: 16 }}>
      <WifiOff size={32} color={c.ink3} />
      <Text variant="h1">You&apos;re offline</Text>
      <Text color={c.ink2}>FITR8 couldn&apos;t reach the server. Check your connection and try again.</Text>
      <Button
        loading={busy}
        onPress={async () => {
          setBusy(true);
          await retry();
          setBusy(false);
        }}
      >
        Try again
      </Button>
    </View>
  );
}
