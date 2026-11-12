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
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";
import { WifiOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Button, Text } from "@/components/ui";
import { OfflineBanner } from "@/components/offline-banner";
import { AuthProvider, useAuth } from "@/lib/auth";
import { queryClient, wireQueryLifecycle } from "@/lib/query";
import { configureNotifications } from "@/lib/reminders";
import { colors } from "@/lib/theme";

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
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <StatusBar style="dark" />
          {fontsLoaded && <Routes />}
          <OfflineBanner />
        </AuthProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

/** Signed out → login; signed in but not onboarded → onboarding only; otherwise the app. */
function Routes() {
  const { status, me } = useAuth();
  useEffect(() => {
    if (status !== "loading") SplashScreen.hideAsync();
  }, [status]);
  if (status === "loading") return null;
  if (status === "offline") return <OfflineStart />;

  const signedIn = status === "signedIn";
  const onboarded = Boolean(me?.onboarded);
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.ground } }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="login" />
      </Stack.Protected>
      {/* Also where an onboarded user edits their goal. */}
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={signedIn && onboarded}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="log" />
        <Stack.Screen name="briefing" />
        <Stack.Screen name="history" />
        <Stack.Screen name="coach" />
        <Stack.Screen name="pro" options={{ presentation: "modal" }} />
      </Stack.Protected>
    </Stack>
  );
}

/** A saved session but no connection at launch: keep the session and let the user retry. */
function OfflineStart() {
  const { retry } = useAuth();
  const [busy, setBusy] = useState(false);
  return (
    <View style={{ flex: 1, backgroundColor: colors.ground, justifyContent: "center", padding: 24, gap: 16 }}>
      <WifiOff size={32} color={colors.ink3} />
      <Text variant="h1">You&apos;re offline</Text>
      <Text color={colors.ink2}>FITR8 couldn&apos;t reach the server. Check your connection and try again.</Text>
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
