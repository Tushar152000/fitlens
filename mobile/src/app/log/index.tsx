import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, Images, Keyboard, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AiLimitSheet, type ScanUsage } from "@/components/log/ai-limit-sheet";
import { ModeTabs } from "@/components/log/mode-tabs";
import { Button, Chip, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { MEAL_LABEL, MEAL_TYPES, type MealType } from "@/lib/format";
import { mealFromParam } from "@/lib/meal-param";
import { compressPhoto, uploadPhoto } from "@/lib/photo";
import { colors, radius } from "@/lib/theme";

type Phase = "idle" | "uploading" | "analysing";

/** Screen 7: camera → compress → signed upload → create meal → confirm. */
export default function CameraScreen() {
  const params = useLocalSearchParams<{ meal?: string }>();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [mealType, setMealType] = useState<MealType>(() => mealFromParam(params.meal));
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<ScanUsage | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const busy = phase !== "idle";

  function fail(e: unknown) {
    setPhase("idle");
    if (e instanceof ApiError && e.status === 429) {
      setLimit((e.details as ScanUsage | undefined) ?? null);
      setLimitOpen(true);
      return;
    }
    setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
  }

  async function submit(photo: { uri: string; width: number; height: number }) {
    setError(null);
    setPhase("uploading");
    try {
      const key = await uploadPhoto(await compressPhoto(photo));
      setPhase("analysing");
      const log = await api<{ id: string }>("/api/meals", { json: { source: "PHOTO", mealType, photoKey: key } });
      router.replace(`/log/${log.id}`);
    } catch (e) {
      fail(e);
    }
  }

  async function shoot() {
    if (!camera.current || !ready) return;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      if (photo) await submit(photo);
    } catch (e) {
      fail(e);
    }
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await submit(asset);
  }

  const granted = permission?.granted;
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} style={styles.close}>
          <X size={26} color={colors.white} />
        </Pressable>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {MEAL_TYPES.map((t) => (
            <Chip key={t} tone="dark" selected={t === mealType} onPress={() => setMealType(t)}>
              {MEAL_LABEL[t]}
            </Chip>
          ))}
        </ScrollView>
      </View>

      <View style={styles.viewfinder}>
        {granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
        ) : (
          <View style={styles.center}>
            <Camera size={32} color="rgba(255,255,255,0.6)" />
            <Text weight={600} color={colors.white} center>
              {permission?.canAskAgain === false ? "Camera access is off" : "Allow the camera to snap your plate"}
            </Text>
            <Text size={13} color="rgba(255,255,255,0.7)" center>
              {permission?.canAskAgain === false
                ? "Turn it on in Settings, or pick a photo from your gallery."
                : "Photos are only used to read your meal."}
            </Text>
            {permission?.canAskAgain !== false && (
              <View style={{ alignSelf: "stretch", marginTop: 8 }}>
                <Button onPress={requestPermission}>Allow camera</Button>
              </View>
            )}
          </View>
        )}
        <Corners />
        <View style={styles.hint} pointerEvents="none">
          <Text weight={600} size={13} color={colors.white}>
            Shoot from above · whole plate in frame
          </Text>
        </View>
        {busy && (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(23,24,28,0.75)" }]}>
            <ActivityIndicator color={colors.white} size="large" />
            <Text weight={600} color={colors.white} accessibilityLiveRegion="polite">
              {phase === "uploading" ? "Uploading your photo…" : "Reading your plate…"}
            </Text>
          </View>
        )}
      </View>

      {error && (
        <Text weight={600} size={13} color="#ffb68a" center style={{ marginHorizontal: 20, marginTop: 12 }}>
          {error}
        </Text>
      )}

      <View style={styles.controls}>
        <SideButton label="Gallery" icon={Images} onPress={pickFromGallery} disabled={busy} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo"
          onPress={shoot}
          disabled={busy || !granted || !ready}
          style={[styles.shutter, (busy || !granted) && { opacity: 0.5 }]}
        >
          {({ pressed }) => <View style={[styles.shutterInner, pressed && { transform: [{ scale: 0.95 }] }]} />}
        </Pressable>
        <SideButton
          label="Type"
          icon={Keyboard}
          onPress={() => router.replace({ pathname: "/log/type", params: { meal: mealType } })}
        />
      </View>

      <View style={{ paddingTop: 20, paddingBottom: Math.max(20, insets.bottom) }}>
        <ModeTabs current="photo" mealType={mealType} />
      </View>

      <AiLimitSheet open={limitOpen} onClose={() => setLimitOpen(false)} mealType={mealType} usage={limit} />
    </View>
  );
}

function SideButton({
  label,
  icon: Icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: typeof Images;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={styles.side}>
      <View style={styles.sideIcon}>
        <Icon size={24} color={colors.white} />
      </View>
      <Text weight={600} size={12} color="rgba(255,255,255,0.85)">
        {label}
      </Text>
    </Pressable>
  );
}

/** Four L-shaped guides framing the plate. */
function Corners() {
  const c = { position: "absolute" as const, width: 36, height: 36, borderColor: "rgba(255,255,255,0.85)" };
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { margin: 20 }]}>
      <View style={[c, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 }]} />
      <View style={[c, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 }]} />
      <View style={[c, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 }]} />
      <View style={[c, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12 },
  close: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  viewfinder: {
    marginHorizontal: 20,
    marginTop: 16,
    aspectRatio: 3 / 4,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  hint: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(23,24,28,0.7)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  controls: {
    marginTop: "auto",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  side: { alignItems: "center", gap: 4, width: 64 },
  sideIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutter: {
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 4,
    borderColor: "rgba(255,255,255,0.35)",
    alignItems: "center",
    justifyContent: "center",
  },
  shutterInner: { width: 62, height: 62, borderRadius: 31, backgroundColor: colors.brandGlow },
});
