import { Minus, Plus } from "lucide-react-native";
import { Pressable, View } from "react-native";
import { formatQty } from "@/lib/format";
import { makeStyles, radius, useColors } from "@/lib/theme";
import { Text } from "./text";

/** −/+ stepper with 44 px buttons on a sunken track. */
export function Stepper({
  value,
  step,
  min = step,
  max = Infinity,
  onChange,
  label,
}: {
  value: number;
  step: number;
  min?: number;
  max?: number;
  onChange: (value: number) => void;
  label: string;
}) {
  const c = useColors();
  const styles = useStyles();
  const round = (n: number) => Math.round(n * 100) / 100;
  const canLess = value - step >= min - 1e-9;
  const canMore = value + step <= max + 1e-9;
  return (
    <View style={styles.track} accessibilityLabel={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Less ${label}`}
        disabled={!canLess}
        onPress={() => onChange(round(value - step))}
        style={styles.btn}
      >
        <Minus size={20} color={canLess ? c.ink : `${c.ink3}80`} strokeWidth={2} />
      </Pressable>
      <Text weight={600} tabular center style={{ minWidth: 32 }} accessibilityLiveRegion="polite">
        {formatQty(value)}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`More ${label}`}
        disabled={!canMore}
        onPress={() => onChange(round(value + step))}
        style={styles.btn}
      >
        <Plus size={20} color={canMore ? c.ink : `${c.ink3}80`} strokeWidth={2} />
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  track: { flexDirection: "row", alignItems: "center", borderRadius: radius.input, backgroundColor: c.sunken },
  btn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
}));
