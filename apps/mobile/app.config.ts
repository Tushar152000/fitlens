/// <reference types="node" />
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Extends app.json with Google Analytics (Firebase), which is only switched on once the Firebase
 * config files exist. The Firebase config plugin fails the build without them, so until then the
 * app builds exactly as before and `src/lib/analytics.ts` sends nothing.
 *
 * Files come from EAS file environment variables (`GOOGLE_SERVICES_JSON`, `GOOGLE_SERVICE_INFO_PLIST`)
 * or, locally, from `google-services.json` / `GoogleService-Info.plist` next to this file.
 * Setup: docs/ANALYTICS.md.
 */
function configFile(fromEnv: string | undefined, localName: string): string | undefined {
  if (fromEnv && existsSync(fromEnv)) return fromEnv;
  return existsSync(resolve(__dirname, localName)) ? `./${localName}` : undefined;
}

type Plugin = string | [string, Record<string, unknown>];

export default ({ config }: ConfigContext): ExpoConfig => {
  const android = configFile(process.env.GOOGLE_SERVICES_JSON, "google-services.json");
  const ios = configFile(process.env.GOOGLE_SERVICE_INFO_PLIST, "GoogleService-Info.plist");
  // The plugin needs both platforms' files whichever platform is being built.
  const firebase = Boolean(android && ios);
  const plugins: Plugin[] = [
    // React Native Firebase v27 is Swift Package Manager only: iOS needs dynamic frameworks even
    // before Firebase is configured, because the native modules are always linked.
    ["expo-build-properties", { ios: { useFrameworks: "dynamic" } }],
    ...(firebase
      ? ([
          "@react-native-firebase/app",
          // No advertising identifier: no App Tracking Transparency prompt, no ad features.
          ["@react-native-firebase/analytics", { ios: { withoutAdIdSupport: true } }],
        ] satisfies Plugin[])
      : []),
  ];

  return {
    ...(config as ExpoConfig),
    android: { ...config.android, ...(firebase && { googleServicesFile: android }) },
    ios: { ...config.ios, ...(firebase && { googleServicesFile: ios }) },
    plugins: [...(config.plugins ?? []), ...plugins],
  };
};
