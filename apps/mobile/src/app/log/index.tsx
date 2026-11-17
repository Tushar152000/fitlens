import { CameraView, scanFromURLAsync, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Barcode, Camera, Images, Keyboard, X } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AiLimitSheet, type ScanUsage } from "@/components/log/ai-limit-sheet";
import { ModeTabs } from "@/components/log/mode-tabs";
import { MealWhen } from "@/components/log/meal-when";
import { Button, Text } from "@/components/ui";
import { api, ApiError } from "@/lib/api";
import { normalizeBarcode } from "@/lib/barcode";
import { useMealChoice } from "@/lib/meal-param";
import { compressPhoto, uploadPhoto } from "@/lib/photo";
import { palettes, radius } from "@/lib/theme";

/** The camera stays dark in both schemes, so its colours are fixed (the light palette's). */
const cam = palettes.light;

type Phase = "idle" | "checking" | "uploading" | "analysing";
type Photo = { uri: string; width: number; height: number };

/** Packaged-food barcodes (EAN-13/8, UPC-A/E), same set as the barcode screen. */
const BARCODE_TYPES = ["ean13", "ean8", "upc_a", "upc_e"] as const;
/** A barcode counts as "in frame" until the camera hasn't seen it for this long. */
const SEEN_FOR_MS = 1200;

/** A valid barcode in a still photo, or null. Never throws: no barcode just means "read the plate". */
async function barcodeInPhoto(uri: string): Promise<string | null> {
  if (Platform.OS === "web") return null;
  try {
    const found = await scanFromURLAsync(uri, [...BARCODE_TYPES]);
    for (const r of found) {
      const code = normalizeBarcode(r.data);
      if (code) return code;
    }
  } catch {
    // Unsupported image or scanner unavailable: fall through to the AI.
  }
  return null;
}

/**
 * Screen 7: one shutter, two paths. A packaged food's barcode (seen live, or found in the photo)
 * opens the product to pick a portion — exact label values, no AI scan used. Anything else goes
 * camera → compress → signed upload → AI meal → confirm.
 */
export default function CameraScreen() {
  const { mealType, setMealType, date, setDate, dateBody, params } = useMealChoice();
  const insets = useSafeAreaInsets();
  const camera = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [ready, setReady] = useState(false);
  const [missing, setMissing] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState<ScanUsage | null>(null);
  const [limitOpen, setLimitOpen] = useState(false);
  // A barcode the camera can see right now; cleared shortly after it leaves the frame.
  const [seen, setSeen] = useState<string | null>(null);
  const seenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A photo taken before a meal was picked: read as soon as the user picks one.
  const [held, setHeld] = useState<Photo | null>(null);
  const busy = phase !== "idle";

  useEffect(
    () => () => {
      if (seenTimer.current) clearTimeout(seenTimer.current);
    },
    [],
  );

  function onBarcode(result: BarcodeScanningResult) {
    const code = normalizeBarcode(result.data);
    if (!code) return;
    setSeen((prev) => {
      if (prev !== code) Vibration.vibrate(30);
      return code;
    });
    if (seenTimer.current) clearTimeout(seenTimer.current);
    seenTimer.current = setTimeout(() => setSeen(null), SEEN_FOR_MS);
  }

  /** The barcode path: the product screen asks for the meal and the portion. */
  function openProduct(code: string) {
    setPhase("idle");
    setHeld(null);
    router.push({ pathname: "/log/barcode/[code]", params: { code, ...params } });
  }

  function fail(e: unknown) {
    setPhase("idle");
    if (e instanceof ApiError && e.status === 429) {
      setLimit((e.details as ScanUsage | undefined) ?? null);
      setLimitOpen(true);
      return;
    }
    setError(e instanceof Error ? e.message : "Something went wrong. Try again.");
  }

  /**
   * Barcode in the photo → product; otherwise the AI reads the plate. The meal is always the user's
   * choice: without one the photo is held and read as soon as they pick.
   */
  async function route(photo: Photo) {
    setError(null);
    setPhase("checking");
    const code = await barcodeInPhoto(photo.uri);
    if (code) return openProduct(code);
    setPhase("idle");
    if (!mealType) {
      setHeld(photo);
      setMissing(true);
      return;
    }
    await submit(photo, mealType);
  }

  async function submit(photo: Photo, meal: NonNullable<typeof mealType>) {
    setHeld(null);
    setError(null);
    setPhase("uploading");
    try {
      const key = await uploadPhoto(await compressPhoto(photo));
      setPhase("analysing");
      const log = await api<{ id: string }>("/api/meals", {
        json: { source: "PHOTO", mealType: meal, photoKey: key, ...dateBody },
      });
      router.replace(`/log/${log.id}`);
    } catch (e) {
      fail(e);
    }
  }

  async function shoot() {
    // A barcode in view wins: no photo, no upload, no scan used.
    if (seen) return openProduct(seen);
    if (!camera.current || !ready) return;
    try {
      const photo = await camera.current.takePictureAsync({ quality: 0.9 });
      if (photo) await route(photo);
    } catch (e) {
      fail(e);
    }
  }

  async function pickFromGallery() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ["images"], quality: 1 });
    const asset = result.canceled ? null : result.assets[0];
    if (asset) await route(asset);
  }

  const granted = permission?.granted;
  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.close}
        >
          <X size={26} color={cam.white} />
        </Pressable>
        <Text weight={600} color={cam.white} style={{ flex: 1 }}>
          Snap your meal
        </Text>
      </View>

      <View style={{ paddingTop: 8, paddingBottom: 12 }}>
        <MealWhen
          tone="dark"
          gutter={20}
          mealType={mealType}
          onMealType={(m) => {
            setMealType(m);
            setMissing(false);
            if (held && m) void submit(held, m);
          }}
          date={date}
          onDate={setDate}
          missing={missing}
          showDay={false}
        />
      </View>

      <View style={styles.viewfinder}>
        {granted ? (
          <CameraView
            ref={camera}
            style={StyleSheet.absoluteFill}
            facing="back"
            onCameraReady={() => setReady(true)}
            barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
            onBarcodeScanned={busy || held ? undefined : onBarcode}
          />
        ) : (
          <View style={styles.center}>
            <Camera size={32} color="rgba(255,255,255,0.6)" />
            <Text weight={600} color={cam.white} center>
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
        {held && <Image source={{ uri: held.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />}
        <Corners color={seen ? cam.proteinSoft : undefined} />
        <View
          style={[styles.hint, { pointerEvents: "none" }, seen && { backgroundColor: cam.protein }]}
          accessibilityLiveRegion="polite"
        >
          {seen && <Barcode size={16} color={cam.white} />}
          <Text weight={600} size={13} color={cam.white} tabular>
            {held
              ? "Pick a meal above to read this photo"
              : seen
                ? `Barcode found · ${seen}`
                : "Snap your plate, or point at a barcode"}
          </Text>
        </View>
        {busy && (
          <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: "rgba(23,24,28,0.75)" }]}>
            <ActivityIndicator color={cam.white} size="large" />
            <Text weight={600} color={cam.white} accessibilityLiveRegion="polite">
              {phase === "checking"
                ? "Checking the photo…"
                : phase === "uploading"
                  ? "Uploading your photo…"
                  : "Reading your plate…"}
            </Text>
          </View>
        )}
      </View>

      {error && (
        <Text weight={600} size={13} color="#ffb68a" center style={{ marginHorizontal: 20, marginTop: 12 }}>
          {error}
        </Text>
      )}

      {held && !busy && (
        <View style={{ marginHorizontal: 20, marginTop: 12 }}>
          <Button variant="ghostDark" onPress={() => setHeld(null)}>
            Retake
          </Button>
        </View>
      )}

      <View style={styles.controls}>
        <SideButton label="Gallery" icon={Images} onPress={pickFromGallery} disabled={busy} />
        <View style={{ alignItems: "center", gap: 6 }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={seen ? `Look up barcode ${seen}` : "Take photo"}
            accessibilityHint={seen ? "Opens the product to pick how much you had" : undefined}
            onPress={shoot}
            disabled={busy || Boolean(held) || !granted || (!ready && !seen)}
            style={[
              styles.shutter,
              seen && { borderColor: "rgba(221,235,227,0.6)" },
              (busy || held || !granted) && { opacity: 0.5 },
            ]}
          >
            {({ pressed }) => (
              <View
                style={[
                  styles.shutterInner,
                  seen && { backgroundColor: cam.protein },
                  pressed && { transform: [{ scale: 0.95 }] },
                ]}
              >
                {seen && <Barcode size={28} color={cam.white} />}
              </View>
            )}
          </Pressable>
          <Text weight={600} size={12} color={seen ? cam.proteinSoft : "rgba(255,255,255,0.85)"}>
            {seen ? "Look up product" : "Snap"}
          </Text>
        </View>
        <SideButton label="Type" icon={Keyboard} onPress={() => router.replace({ pathname: "/log/type", params })} />
      </View>

      <View style={{ paddingTop: 20, paddingBottom: Math.max(20, insets.bottom) }}>
        <ModeTabs current="photo" params={params} />
      </View>

      <AiLimitSheet open={limitOpen} onClose={() => setLimitOpen(false)} params={params} usage={limit} />
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
        <Icon size={24} color={cam.white} />
      </View>
      <Text weight={600} size={12} color="rgba(255,255,255,0.85)">
        {label}
      </Text>
    </Pressable>
  );
}

/** Four L-shaped guides framing the plate (green while a barcode is in view). */
function Corners({ color = "rgba(255,255,255,0.85)" }: { color?: string }) {
  const c = { position: "absolute" as const, width: 36, height: 36, borderColor: color };
  return (
    <View style={[StyleSheet.absoluteFill, { margin: 20, pointerEvents: "none" }]}>
      <View style={[c, { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3, borderTopLeftRadius: 16 }]} />
      <View style={[c, { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3, borderTopRightRadius: 16 }]} />
      <View style={[c, { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3, borderBottomLeftRadius: 16 }]} />
      <View
        style={[c, { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3, borderBottomRightRadius: 16 }]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: cam.panel },
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
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
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
  shutterInner: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: cam.brandGlow,
    alignItems: "center",
    justifyContent: "center",
  },
});
