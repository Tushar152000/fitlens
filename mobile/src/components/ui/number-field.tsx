import { useState } from "react";
import { StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { colors, fonts, radius } from "@/lib/theme";
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
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ gap: 6, flex: 1 }}>
      <Text variant="label">{label}</Text>
      <View
        style={[
          styles.box,
          { borderColor: error ? colors.caution : focused ? colors.ink : colors.lineStrong },
        ]}
      >
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(v) => onValueChange(v.replace(",", "."))}
          keyboardType={keyboardType}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholderTextColor="rgba(107,110,118,0.6)"
          style={styles.input}
          {...props}
        />
        {unit && (
          <Text weight={500} color={colors.ink3} style={{ marginLeft: 8 }}>
            {unit}
          </Text>
        )}
      </View>
      {error ? <FieldError>{error}</FieldError> : hint ? <Text size={13} color={colors.ink3}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  box: {
    height: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    paddingHorizontal: 16,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontFamily: fonts.sans600,
    fontSize: 18,
    color: colors.ink,
    fontVariant: ["tabular-nums"],
    padding: 0,
  },
});
