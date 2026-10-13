import { useQuery } from "@tanstack/react-query";
import * as AppleAuthentication from "expo-apple-authentication";
import type { ProvidersDto } from "@fitr8/contracts";
import { LogIn } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, TextInput, useWindowDimensions, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { HeroPlate } from "@/components/hero-plate";
import { Button, FieldError, Logo, Screen, Text } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { openLegal } from "@/lib/legal";
import { colors, fonts, radius } from "@/lib/theme";

function useProviders() {
  return useQuery({
    queryKey: ["auth-providers"],
    queryFn: () => api<ProvidersDto>("/api/auth/providers"),
    staleTime: Infinity,
    retry: false,
  });
}

/** Sign in with Apple is offered on iOS devices that support it (App Store guideline 4.8). */
function useAppleAvailable() {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    if (Platform.OS !== "ios") return;
    AppleAuthentication.isAvailableAsync().then(setAvailable, () => setAvailable(false));
  }, []);
  return available;
}

/**
 * Screen 1: welcome + sign-in. Apple (iOS) uses the system sheet; Google opens in the system browser
 * and hands a code back to the app.
 */
export default function LoginScreen() {
  const { signIn, appleSignIn } = useAuth();
  const { width } = useWindowDimensions();
  const providers = useProviders();
  const appleAvailable = useAppleAvailable();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const showApple = appleAvailable && Boolean(providers.data?.apple);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      gutter={24}
      footer={
        <>
          {showApple && (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={radius.button}
              onPress={() => !busy && run(appleSignIn)}
              style={{ width: "100%", height: 54 }}
            />
          )}
          <Button variant={showApple ? "secondary" : "strong"} onPress={() => run(signIn)} loading={busy}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <GoogleMark />
              <Text variant="button" color={appleAvailable && providers.data?.apple ? colors.ink : colors.white}>
                Continue with Google
              </Text>
            </View>
          </Button>
          {error && <FieldError>{error}</FieldError>}
          <DevSignIn />
          <Text size={12} color={colors.ink3} center>
            By continuing you agree to our{" "}
            <Text size={12} color={colors.brand} weight={600} onPress={() => openLegal("terms")}>
              Terms
            </Text>{" "}
            and{" "}
            <Text size={12} color={colors.brand} weight={600} onPress={() => openLegal("privacy")}>
              Privacy Policy
            </Text>
            . FITR8 gives general fitness guidance and is not medical advice.
          </Text>
        </>
      }
    >
      <Logo size={30} />
      <View style={styles.hero}>
        <HeroPlate size={Math.min(240, width - 48 - 40)} />
      </View>
      <View style={{ gap: 12 }}>
        <Text variant="display">Snap your meal. Hit your goal.</Text>
        <Text color={colors.ink2}>
          Take a photo of your thali. We find the foods and portions, you confirm, and calories and macros are logged
          against targets built for your goal.
        </Text>
      </View>
    </Screen>
  );
}

/**
 * Local development only: the API offers email sign-in when it isn't deployed, so the app works on a
 * phone without Google (whose redirect can't reach a laptop's localhost). Hidden everywhere else.
 */
function DevSignIn() {
  const { devSignIn } = useAuth();
  const providers = useProviders();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!providers.data?.dev) return null;

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      await devSignIn(email.trim());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't sign in. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ gap: 12 }}>
      <Text variant="label">Developer sign-in</Text>
      <TextInput
        accessibilityLabel="Email"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submit}
        placeholder="you@example.com"
        placeholderTextColor="rgba(107,110,118,0.6)"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        style={styles.input}
      />
      <Button variant="secondary" icon={LogIn} onPress={submit} loading={busy} disabled={!email.trim()}>
        Sign in with email (dev)
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    borderRadius: radius.sheet,
    backgroundColor: colors.brand,
    paddingVertical: 20,
    paddingHorizontal: 20,
  },
  input: {
    height: 54,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans500,
    fontSize: 16,
    color: colors.ink,
  },
});

function GoogleMark() {
  return (
    <Svg viewBox="0 0 24 24" width={20} height={20}>
      <Path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z"
      />
      <Path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z"
      />
      <Path
        fill="#FBBC05"
        d="M5.84 14.1A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.44.34-2.1V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <Path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15A10.96 10.96 0 0 0 12 1 11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </Svg>
  );
}
