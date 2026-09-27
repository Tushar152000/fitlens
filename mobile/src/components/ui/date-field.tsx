import { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { colors, fonts, radius } from "@/lib/theme";
import { FieldError } from "./field-error";
import { Text } from "./text";

const pad = (s: string, n: number) => s.padStart(n, "0");

function split(value: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? { y: m[1], m: m[2], d: m[3] } : { y: "", m: "", d: "" };
}

/** A real calendar date, or "" while incomplete or impossible (31 Feb). */
function compose(d: string, m: string, y: string): string {
  if (!d || !m || y.length !== 4) return "";
  const iso = `${y}-${pad(m, 2)}-${pad(d, 2)}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso ? "" : iso;
}

/**
 * Day / month / year boxes styled like NumberField. Value is YYYY-MM-DD, or "" until complete.
 * Three number pads are quicker than a picker for a birth date and work the same on every phone.
 */
export function DateField({
  label,
  value,
  onValueChange,
  error,
  hint,
}: {
  label: string;
  value: string;
  onValueChange: (value: string) => void;
  error?: string;
  hint?: string;
}) {
  const [parts, setParts] = useState(() => split(value));
  const month = useRef<TextInput>(null);
  const year = useRef<TextInput>(null);

  // Follow outside changes (e.g. a tile picked a date) without fighting the user's typing.
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    if (value && value !== compose(parts.d, parts.m, parts.y)) setParts(split(value));
  }

  const update = (key: "d" | "m" | "y", raw: string) => {
    const digits = raw.replace(/\D/g, "").slice(0, key === "y" ? 4 : 2);
    const next = { ...parts, [key]: digits };
    setParts(next);
    onValueChange(compose(next.d, next.m, next.y));
    if (key === "d" && digits.length === 2) month.current?.focus();
    if (key === "m" && digits.length === 2) year.current?.focus();
  };

  const box = (key: "d" | "m" | "y", placeholder: string, flex: number, ref?: React.Ref<TextInput>) => (
    <View style={[styles.box, { flex, borderColor: error ? colors.caution : colors.lineStrong }]}>
      <TextInput
        ref={ref}
        accessibilityLabel={`${label}: ${key === "d" ? "day" : key === "m" ? "month" : "year"}`}
        value={parts[key]}
        onChangeText={(v) => update(key, v)}
        placeholder={placeholder}
        placeholderTextColor="rgba(107,110,118,0.6)"
        keyboardType="number-pad"
        maxLength={key === "y" ? 4 : 2}
        style={styles.input}
      />
    </View>
  );

  return (
    <View style={{ gap: 6 }}>
      <Text variant="label">{label}</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {box("d", "DD", 1)}
        {box("m", "MM", 1, month)}
        {box("y", "YYYY", 1.6, year)}
      </View>
      {error ? <FieldError>{error}</FieldError> : hint ? <Text size={13} color={colors.ink3}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  input: { fontFamily: fonts.sans600, fontSize: 18, color: colors.ink, fontVariant: ["tabular-nums"], padding: 0 },
});
