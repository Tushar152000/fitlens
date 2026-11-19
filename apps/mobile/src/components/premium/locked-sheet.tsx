import { router } from "expo-router";
import { Check, Crown } from "lucide-react-native";
import { useEffect } from "react";
import { View } from "react-native";
import { Sheet } from "@/components/sheet";
import { Button, Text } from "@/components/ui";
import { track } from "@/lib/analytics";
import { FEATURE_LABEL, LIST_PRICE, openPaywall, useLockedSheet, type PremiumFeature } from "@/lib/premium";
import { makeStyles, useColors } from "@/lib/theme";
import { ExampleCard } from "./examples";

type Copy = { title: string; body: string; checks: string[]; free: string | null };

const FROM = `From ${LIST_PRICE.perMonth} a month, cancel anytime`;

/** Per-feature copy (docs/PREMIUM.md, design 14b). `free` = the free alternative's button. */
const COPY: Partial<Record<PremiumFeature, Copy>> = {
  photo_scan: {
    title: "Photo scanning is part of Premium",
    body: "Snap your plate and fitr8 finds each dish, estimates the portion and fills in calories and macros. Fix anything with one tap.",
    checks: ["Up to 10 photo scans a day", "Barcode and label scanning included", FROM],
    free: "Type this meal instead (free)",
  },
  barcode: {
    title: "Barcode scanning is part of Premium",
    body: "Point at the barcode on any pack and fitr8 fills in the exact label nutrition. Change the serving to half a pack or 3 biscuits.",
    checks: ["Exact nutrition for packed food", "Photo and label scanning included", FROM],
    free: "Type this meal instead (free)",
  },
  label_scan: {
    title: "Label reading is part of Premium",
    body: "No barcode? Photograph the nutrition table on the pack and fitr8 reads it into exact values for you to check.",
    checks: ["Exact values from the label", "Barcode and photo scanning included", FROM],
    free: "Type this meal instead (free)",
  },
  coach: {
    title: "The AI Coach is part of Premium",
    body: "Ask what to eat for dinner or how to adjust today's workout. Answers use your log and your goal.",
    checks: ["Nutrition and training advice made for you", "Photo and barcode scanning included", FROM],
    free: null,
  },
};

/**
 * Design 14b: a free user tapped a Premium feature. One sheet for photo, barcode, label and coach:
 * an example of the result, what Premium includes, the plans, and always the free way forward.
 * Rendered once in the root layout; screens open it with `openPremium(feature, context)`.
 */
export function PremiumLockedSheet() {
  const c = useColors();
  const styles = useStyles();
  const { state, close } = useLockedSheet();
  const copy = state ? COPY[state.feature] : undefined;
  const label = state ? FEATURE_LABEL[state.feature] : null;

  useEffect(() => {
    if (label) track("premium_locked_sheet_shown", { feature: label });
  }, [label, state]);

  if (!state || !copy || !label) return null;
  return (
    <Sheet open onClose={close} title="">
      <ExampleCard feature={state.feature} />
      <View style={styles.chip}>
        <Crown size={13} color={c.brandText} />
        <Text size={12} weight={700} color={c.brandText}>
          Premium
        </Text>
      </View>
      <View style={{ gap: 6 }}>
        <Text variant="h2">{copy.title}</Text>
        <Text color={c.ink2}>{copy.body}</Text>
      </View>
      <View style={{ gap: 8 }}>
        {copy.checks.map((line) => (
          <View key={line} style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Check size={18} color={c.protein} strokeWidth={2.6} />
            <Text size={14}>{line}</Text>
          </View>
        ))}
      </View>
      <View style={{ gap: 10 }}>
        <Button
          onPress={() => {
            close();
            openPaywall(`locked_${label}`);
          }}
        >
          See Premium plans
        </Button>
        <Button
          variant="secondary"
          onPress={() => {
            close();
            track("premium_locked_free_path", { feature: label });
            const params = Object.fromEntries(Object.entries(state.context).filter(([, v]) => v));
            if (copy.free) router.push({ pathname: "/log/type", params });
          }}
        >
          {copy.free ?? "Not now"}
        </Button>
      </View>
    </Sheet>
  );
}

const useStyles = makeStyles((c) => ({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    backgroundColor: c.brandSoft,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
}));
