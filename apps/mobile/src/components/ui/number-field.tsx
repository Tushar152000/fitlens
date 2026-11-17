import { useState } from "react";
import { TextInput, View, type TextInputProps } from "react-native";
import { fonts, makeStyles, radius, useColors } from "@/lib/theme";
import { FieldError } from "./field-error";
import { Text } from "./text";

/** Label above, 52 px box, big value with a unit suffix. Keeps the raw string so users can type "7" then "72.5". */
export function NumberField({
  label,
  unit,
  value,
  onValueChange,
  hint,
  error,
  keyboardType = "decimal-pad",
  ...props
}: {
  label: string;
  unit?: string;
  value: string;
  onValueChange: (value: string) => void;
  hint?: string;
  error?: string;
} & Omit<TextInputProps, "value" | "onChangeText">) {
  const c = useColors();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text variant="label">{label}</Text>
      <View style={[styles.box, { borderColor: error ? c.caution : focused ? c.ink : c.lineStrong }]}>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(v) => onValueChange(v.replace(",", "."))}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor={`${c.ink3}99`}
          style={styles.input}
          {...props}
        />
        {unit && (
          <Text weight={500} color={c.ink3} style={{ marginLeft: 8 }}>
            {unit}
          </Text>
        )}
      </View>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : hint ? (
        <Text size={13} color={c.ink3}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((c) => ({
  box: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: c.surface,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.sans600,
    fontSize: 18,
    color: c.ink,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
}));
