import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { router, useLocalSearchParams } from "expo-router";
import { Camera, Flashlight, FlashlightOff, Hash, ScanText, X } from "lucide-react-native";
import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, Vibration, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ModeTabs } from "@/components/log/mode-tabs";
import { Sheet } from "@/components/sheet";
import { Button, FieldError, Text } from "@/components/ui";
import { normalizeBarcode } from "@/lib/barcode";
import { mealFromParam } from "@/lib/meal-param";
import { colors, fonts, radius } from "@/lib/theme";

/** Screen 7c: scan a packaged food's barcode (EAN-13/8, UPC-A/E). One code = one lookup. */
export default function BarcodeScreen() {
  const params = useLocalSearchParams<{ meal?: string }>();
  const mealType = mealFromParam(params.meal);
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState<string | null>(null);
  const [torch, setTorch] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [typedError, setTypedError] = useState<string | null>(null);
  const locked = useRef(false);

  const open = (c: string) => router.push({ pathname: "/log/barcode/[code]", params: { code: c, meal: mealType } });

  function onScanned(result: BarcodeScanningResult) {
    if (locked.current) return;
    const valid = normalizeBarcode(result.data);
    if (!valid) return;
    locked.current = true;
    Vibration.vibrate(40);
    setCode(valid);
  }

  function submitTyped() {
    const valid = normalizeBarcode(typed);
    if (!valid) return setTypedError("That number doesn't look right. Check the digits under the bars.");
    setTypeOpen(false);
    open(valid);
  }

  const granted = permission?.granted;
  const status = code
    ? "Barcode read"
    : granted
      ? "Line up the barcode inside the box"
      : "Camera isn't available — type the number instead";

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={() => router.back()}
          style={styles.icon}
        >
          <X size={26} color={colors.white} />
        </Pressable>
        <Text weight={600} color={colors.white}>
          Scan barcode
        </Text>
        {granted ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={torch ? "Turn torch off" : "Turn torch on"}
            accessibilityState={{ selected: torch }}
            onPress={() => setTorch((t) => !t)}
            style={styles.icon}
          >
            {torch ? <FlashlightOff size={24} color={colors.white} /> : <Flashlight size={24} color={colors.white} />}
          </Pressable>
        ) : (
          <View style={styles.icon} />
        )}
      </View>

      <View style={styles.viewfinder}>
        {granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            enableTorch={torch}
            barcodeScannerSettings={{ barcodeTypes: ["ean13", "ean8", "upc_a", "upc_e"] }}
            onBarcodeScanned={code ? undefined : onScanned}
          />
        ) : (
          <View style={styles.center}>
            <Camera size={32} color="rgba(255,255,255,0.6)" />
            <Text size={13} color="rgba(255,255,255,0.7)" center>
              Allow camera access, or type the number printed under the barcode.
            </Text>
            {permission?.canAskAgain !== false && (
              <View style={{ alignSelf: "stretch", marginTop: 8 }}>
                <Button onPress={requestPermission}>Allow camera</Button>
              </View>
            )}
          </View>
        )}
        {/* Wide scan box; a thick translucent border dims everything around it. */}
        <View pointerEvents="none" style={styles.dim}>
          <View style={[styles.box, { borderColor: code ? colors.proteinSoft : "rgba(255,255,255,0.9)" }]}>
            {!code && granted && <View style={styles.laser} />}
          </View>
        </View>
        <View
          accessibilityLiveRegion="polite"
          style={[styles.status, { backgroundColor: code ? colors.protein : "rgba(23,24,28,0.75)" }]}
        >
          <Text weight={600} size={13} color={colors.white} tabular>
            {status}
            {code ? ` · ${code}` : ""}
          </Text>
        </View>
      </View>

      <View style={{ marginTop: "auto", paddingHorizontal: 20, paddingTop: 20, gap: 10 }}>
        {code ? (
          <>
            <Button onPress={() => open(code)}>See product</Button>
            <Button
              variant="ghostDark"
              onPress={() => {
                locked.current = false;
                setCode(null);
              }}
            >
              Scan another
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghostDark" icon={Hash} onPress={() => setTypeOpen(true)}>
              Type the number
            </Button>
            <Button
              variant="ghostDark"
              icon={ScanText}
              onPress={() => router.push({ pathname: "/log/label", params: { meal: mealType } })}
            >
              Scan the label
            </Button>
          </>
        )}
      </View>

      <View style={{ paddingTop: 20, paddingBottom: Math.max(20, insets.bottom) }}>
        <ModeTabs current="barcode" mealType={mealType} />
      </View>

      <Sheet open={typeOpen} onClose={() => setTypeOpen(false)} title="Type the barcode number">
        <Text variant="label">The 8, 12 or 13 digits under the bars</Text>
        <TextInput
          accessibilityLabel="Barcode number"
          keyboardType="number-pad"
          value={typed}
          onChangeText={(v) => {
            setTyped(v);
            setTypedError(null);
          }}
          onSubmitEditing={submitTyped}
          placeholder="8901719110023"
          placeholderTextColor="rgba(107,110,118,0.6)"
          style={styles.number}
        />
        {typedError && <FieldError>{typedError}</FieldError>}
        <Button onPress={submitTyped}>Find product</Button>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
  icon: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  viewfinder: {
    marginHorizontal: 20,
    marginTop: 16,
    aspectRatio: 3 / 4,
    borderRadius: radius.card,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 32 },
  dim: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, justifyContent: "center", paddingHorizontal: 24 },
  box: {
    height: 128,
    borderWidth: 3,
    borderRadius: 18,
    justifyContent: "center",
    boxShadow: "0 0 0 999px rgba(23, 24, 28, 0.55)",
  },
  laser: {
    marginHorizontal: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.brandGlow,
    boxShadow: "0 0 12px 2px rgba(232, 119, 46, 0.7)",
  },
  status: {
    position: "absolute",
    bottom: 20,
    alignSelf: "center",
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  number: {
    height: 52,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    fontFamily: fonts.sans600,
    fontSize: 18,
    letterSpacing: 1,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
  },
});
