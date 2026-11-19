import { ScanBarcode, Sparkles } from "lucide-react-native";
import { View } from "react-native";
import { Text } from "@/components/ui";
import type { PremiumFeature } from "@/lib/premium";
import { makeStyles, radius, useColors } from "@/lib/theme";

/**
 * "Example result" cards for the locked sheet and the Premium screen: what a feature does, shown
 * with a made-up but realistic Indian example (always labelled as an example).
 */
export function ExampleCard({ feature }: { feature: PremiumFeature }) {
  switch (feature) {
    case "photo_scan":
      return <ThaliExample />;
    case "barcode":
      return <BarcodeExample />;
    case "label_scan":
      return <LabelExample />;
    case "coach":
      return <CoachExample />;
    default:
      return null;
  }
}

const DISHES = [
  { name: "Dal", x: 18, y: 14 },
  { name: "Rice", x: 62, y: 10 },
  { name: "Sabzi", x: 16, y: 58 },
  { name: "2 roti", x: 58, y: 56 },
];

function ThaliExample() {
  const c = useColors();
  const styles = useStyles();
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel="Example result: a thali photo with 4 items found, 780 kcal and 23 g protein"
    >
      <View style={styles.thali}>
        {DISHES.map((d) => (
          <View key={d.name} style={[styles.dish, { left: `${d.x}%`, top: `${d.y}%` }]}>
            <View style={styles.bowl} />
            <View style={styles.dishLabel}>
              <Text size={11} weight={700} color={c.white}>
                {d.name}
              </Text>
            </View>
          </View>
        ))}
      </View>
      <Footer title="Example result · 4 items" value="780 kcal · 23 g protein" />
    </View>
  );
}

function BarcodeExample() {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.card} accessible accessibilityLabel="Example result: curd 400 g, 64 kcal per 100 g">
      <View style={[styles.row, { padding: 14 }]}>
        <View style={styles.pack}>
          <Text size={12} weight={700} color={c.ink}>
            Curd
          </Text>
          <Text size={11} color={c.ink3}>
            400 g
          </Text>
          <View style={styles.bars}>
            {[2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 2].map((w, i) => (
              <View key={i} style={{ width: w, height: 18, backgroundColor: c.ink }} />
            ))}
          </View>
        </View>
        <ScanBarcode size={22} color={c.brandText} />
        <View style={{ flex: 1, gap: 2 }}>
          <Text size={13} color={c.ink3}>
            Per 100 g
          </Text>
          <Text weight={700} tabular>
            64 kcal
          </Text>
          <Text size={12} color={c.ink3} tabular>
            3.5 g protein · 4.7 g carbs · 3.1 g fat
          </Text>
        </View>
      </View>
      <Footer title="Example result" value="Curd 400 g → 64 kcal per 100 g" />
    </View>
  );
}

const LABEL_ROWS = [
  ["Energy", "448 kcal"],
  ["Protein", "7.9 g"],
  ["Carbohydrate", "66 g"],
  ["Fat", "17 g"],
] as const;

function LabelExample() {
  const c = useColors();
  const styles = useStyles();
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel="Example result: a nutrition label read into protein, carbs and fat"
    >
      <View style={{ padding: 14, gap: 8 }}>
        <View style={styles.label}>
          <Text size={12} weight={700} color={c.ink}>
            Nutrition information · per 100 g
          </Text>
          {LABEL_ROWS.map(([k, v]) => (
            <View key={k} style={[styles.row, { justifyContent: "space-between" }]}>
              <Text size={12} color={c.ink2}>
                {k}
              </Text>
              <Text size={12} weight={700} color={c.ink} tabular>
                {v}
              </Text>
            </View>
          ))}
        </View>
      </View>
      <Footer title="Example result" value="Label photo → protein, carbs, fat" />
    </View>
  );
}

function CoachExample() {
  const c = useColors();
  const styles = useStyles();
  return (
    <View
      style={styles.card}
      accessible
      accessibilityLabel="Example: you ask, 520 kcal left, what should I eat? The coach suggests a dinner"
    >
      <View style={{ padding: 14, gap: 8 }}>
        <View style={[styles.bubble, styles.mine]}>
          <Text size={13} color={c.onStrong}>
            520 kcal left, what should I eat?
          </Text>
        </View>
        <View style={[styles.bubble, styles.theirs]}>
          <View style={[styles.row, { gap: 6 }]}>
            <Sparkles size={14} color={c.brandText} />
            <Text size={12} weight={700} color={c.brandText}>
              Coach
            </Text>
          </View>
          <Text size={13}>
            Paneer bhurji with 2 roti and a bowl of curd fits well: about 500 kcal, and it covers most of the protein
            you still need today.
          </Text>
        </View>
      </View>
      <Footer title="Example answer" value="Uses your log and your goal" />
    </View>
  );
}

function Footer({ title, value }: { title: string; value: string }) {
  const c = useColors();
  const styles = useStyles();
  return (
    <View style={styles.footer}>
      <Text size={12} weight={600} color={c.ink3}>
        {title}
      </Text>
      <Text size={14} weight={700} tabular>
        {value}
      </Text>
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: c.premiumLine,
    backgroundColor: c.surface,
    overflow: "hidden",
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  thali: {
    height: 150,
    margin: 14,
    borderRadius: 999,
    alignSelf: "center",
    aspectRatio: 1,
    backgroundColor: c.sunken,
    borderWidth: 6,
    borderColor: c.lineStrong,
  },
  dish: { position: "absolute", alignItems: "center", gap: 2 },
  bowl: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.carbs, opacity: 0.85 },
  dishLabel: { backgroundColor: c.brand, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  pack: {
    width: 76,
    padding: 8,
    gap: 2,
    borderRadius: 10,
    backgroundColor: c.white,
    borderWidth: 1,
    borderColor: c.line,
  },
  bars: { flexDirection: "row", gap: 1.5, marginTop: 4 },
  label: { backgroundColor: c.white, borderRadius: 10, padding: 10, gap: 4, borderWidth: 1, borderColor: c.line },
  bubble: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, gap: 4, maxWidth: "90%" },
  mine: { alignSelf: "flex-end", backgroundColor: c.strong },
  theirs: { alignSelf: "flex-start", backgroundColor: c.sunken },
  footer: { paddingHorizontal: 14, paddingVertical: 10, gap: 2, backgroundColor: c.sunken },
}));
