import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, ChevronLeft, Images } from "lucide-react-native";
import { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AiLimitSheet, type ScanUsage } from "@/components/log/ai-limit-sheet";
import { Button, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { mealFromParam } from "@/lib/meal-param";
import { compressPhoto, uploadPhoto } from "@/lib/photo";
import { colors, radius } from "@/lib/theme";

/** Labels have small print, so keep more pixels than a plate photo. */
const LABEL_MAX_SIDE = 1600;

/** Screen 7f: dark camera with a tall frame for the nutrition table. Uses 1 photo scan. */
export default function LabelCamera() {
  const params = useLocalSearchParams<{ meal?: string; barcode?: string; name?: string }>();
  const mealType = mealFromParam(params.meal);
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [phase, setPhase] = useState<"idle" | "uploading" | "reading">("idle");
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<ScanUsage | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  const busy = phase !== "idle";

  async function submit(photo: { uri: string; width: number; height: number }) {
    setError(null);
    setPhase("uploading");
    try {
      const photoKey = await uploadPhoto(await compressPhoto(photo, LABEL_MAX_SIDE, 0.88));
      setPhase("reading");
      const scan = await api<{ id: string }>("/api/foods/label", {
        json: { photoKey, barcode: params.barcode, name: params.name },
      });
      router.replace({ pathname: "/log/label/[id]", params: { id: scan.id, meal: mealType } });
    } catch (e) {
      setPhase("idle");
      if (e instanceof ApiError && e.status === 429) {
        setLimit((e.details as ScanUsage | undefined) ?? null);
        setLimitOpen(true);
      } else {
        setError(e instanceof Error ? e.message : "Couldn't read the label. Try again.");
      }
    }
  }

  async function shoot() {
    if (!camera.current || !ready) return;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.95 });
      if (photo) await submit(photo);
    } catch {
      setError("Couldn't take the photo. Try again.");
    }
  }

  async function pick() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await submit(asset);
  }

  const granted = permission?.granted;
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} style={styles.icon}>
          <ChevronLeft size={26} color={colors.white} />
        </Pressable>
        <Text weight={600} color={colors.white}>
          Photograph the label
        </Text>
        <View style={styles.icon} />
      </View>

      <View style={styles.viewfinder}>
        {granted ? (
          <CameraView ref={camera} style={StyleSheet.absoluteFill} facing="back" onCameraReady={() => setReady(true)} />
        ) : (
          <View style={styles.center}>
            <Camera size={32} color="rgba(255,255,255,0.6)" />
            <Text size={13} color="rgba(255,255,255,0.7)" center>
              Allow the camera to photograph the label, or pick a photo from your gallery.
            </Text>
            {permission?.canAskAgain !== false && (
              <View style={{ alignSelf: "stretch", marginTop: 8 }}>
                <Button onPress={requestPermission}>Allow camera</Button>
              </View>
            )}
          </View>
        )}
        {/* Tall frame for the nutrition table. */}
        <View pointerEvents="none" style={styles.frame} />
        <View pointerEvents="none" style={styles.hint}>
          <Text weight={600} size={13} color={colors.white}>
            Whole table in frame · per 100 g visible
          </Text>
        </View>
        {busy && (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(23,24,28,0.75)" }]}>
            <ActivityIndicator color={colors.white} size="large" />
            <Text weight={600} color={colors.white} accessibilityLiveRegion="polite">
              {phase === "uploading" ? "Uploading…" : "Reading the label…"}
            </Text>
          </View>
        )}
      </View>

      {error && (
        <Text weight={600} size={13} color="#ffb68a" center style={{ marginHorizontal: 20, marginTop: 12 }}>
          {error}
        </Text>
      )}

      <View style={[styles.controls, { paddingBottom: Math.max(28, insets.bottom + 8) }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Pick from gallery" onPress={pick} disabled={busy} style={styles.side}>
          <Images size={24} color={colors.white} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Take photo of label"
          onPress={shoot}
          disabled={busy || !granted || !ready}
          style={[styles.shutter, (busy || !granted) && { opacity: 0.5 }]}
        >
          <View style={styles.shutterInner} />
        </Pressable>
        <View style={{ width: 48 }} />
      </View>

      <AiLimitSheet open={limitOpen} onClose={() => setLimitOpen(false)} mealType={mealType} usage={limit} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  viewfinder: {
    flex: 1,
    marginHorizontal: 20,
    marginTop: 16,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  frame: {
    position: "absolute",
    left: 40,
    right: 40,
    top: 24,
    bottom: 64,
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.9)",
    borderRadius: 18,
    boxShadow: "0 0 0 999px rgba(23, 24, 28, 0.5)",
  },
  hint: {
    position: "absolute",
    bottom: 16,
    alignSelf: "center",
    borderRadius: 999,
    backgroundColor: "rgba(23,24,28,0.75)",
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  controls: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 32, paddingTop: 24 },
  side: {
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
