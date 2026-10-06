import { router } from "expo-router";
import type { UsageDto } from "@fitr8/contracts";
import { Crown, Keyboard } from "lucide-react-native";
import { useState } from "react";
import { View } from "react-native";
import { Sheet } from "@/components/sheet";
import { Button, Card, Text } from "@/components/ui";
import type { MealType } from "@/lib/format";
import { colors } from "@/lib/theme";

export type ScanUsage = UsageDto;

/** Design 9c: shown on HTTP 429 from a photo scan. Typing a meal is always free. */
export function AiLimitSheet({
  open,
  onClose,
  mealType,
  usage,
}: {
  open: boolean;
  onClose: () => void;
  mealType: MealType;
  usage: ScanUsage | null;
}) {
  const [proNote, setProNote] = useState(false);
  const limit = usage?.limit ?? 3;
  const used = Math.min(usage?.used ?? limit, limit);
  const pips = Math.min(limit, 10);
  const usedPips = Math.min(pips, Math.round((used / limit) * pips));
  const resets = usage
    ? new Intl.DateTimeFormat("en-IN", { hour: "numeric", minute: "2-digit" }).format(new Date(usage.resetsAt))
    : "midnight";

  return (
    <Sheet open={open} onClose={onClose} title={`You've used today's ${limit} free photo scans`}>
      <View
        style={{ flexDirection: "row", gap: 6 }}
        accessible
        accessibilityLabel={`${used} of ${limit} photo scans used today`}
      >
        {Array.from({ length: pips }, (_, i) => (
          <View
            key={i}
            style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: i < usedPips ? colors.brand : colors.track }}
          />
        ))}
      </View>
      <Text color={colors.ink2}>Scans reset at {resets}. Typing a meal is free and doesn&apos;t use a scan.</Text>
      <Card dark style={{ gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <Crown size={20} color={colors.brandGlow} />
          <Text weight={700} color={colors.white}>
            FITR8 Pro
          </Text>
        </View>
        <Text size={13} color="rgba(255,255,255,0.75)">
          Unlimited photo scans, label reading and weekly coaching.
        </Text>
        <Text variant="h2" size={22} color={colors.white} tabular>
          [PRICE]{" "}
          <Text weight={600} size={13} color="rgba(255,255,255,0.7)">
            / month
          </Text>
        </Text>
      </Card>
      <Button onPress={() => setProNote(true)}>Upgrade to Pro</Button>
      {proNote && (
        <Text size={13} color={colors.ink3} center>
          Pro isn&apos;t available yet. Typing your meal works now.
        </Text>
      )}
      <Button
        variant="secondary"
        icon={Keyboard}
        onPress={() => {
          onClose();
          router.replace({ pathname: "/log/type", params: { meal: mealType } });
        }}
      >
        Type my meal instead
      </Button>
    </Sheet>
  );
}
