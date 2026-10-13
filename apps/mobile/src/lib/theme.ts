/** FITR8 tokens from docs/DESIGN.md. Keep in step with apps/web/src/app/globals.css. */
export const colors = {
  ground: "#f6f6f8",
  surface: "#ffffff",
  sunken: "#f0f0f5",
  track: "#ececf2",
  line: "#e3e3ea",
  lineStrong: "#d4d4de",
  ink: "#151724",
  ink2: "#4a4c5a",
  ink3: "#6b6d7a",
  brand: "#8116e0",
  brandHover: "#6a0fbd",
  brandGlow: "#a855f7",
  protein: "#2f6b4f",
  proteinSoft: "#ddebe3",
  carbs: "#e3a13b",
  carbsText: "#9a6212",
  fat: "#c0396b",
  caution: "#e8a15c",
  cautionSoft: "#fdebd3",
  cautionText: "#8a3c08",
  water: "#2f6f9f", // water card and bar; text-safe on ground and surface
  waterSoft: "#dde9f2",
  chip: "#ebebf1",
  dash: "#c4c4d0",
  white: "#ffffff",
} as const;

export const radius = { input: 14, button: 16, card: 20, sheet: 28 } as const;

/** Screen gutter: 20 on app screens, 24 on onboarding. */
export const gutter = 20;

/** Custom fonts need one family per weight on native. */
export const fonts = {
  display500: "BricolageGrotesque_500Medium",
  display600: "BricolageGrotesque_600SemiBold",
  display700: "BricolageGrotesque_700Bold",
  display800: "BricolageGrotesque_800ExtraBold",
  sans400: "Figtree_400Regular",
  sans500: "Figtree_500Medium",
  sans600: "Figtree_600SemiBold",
  sans700: "Figtree_700Bold",
} as const;

/** Flat design: the camera FAB is the only real shadow; `seg` lifts the selected segment. */
export const shadows = {
  fab: { boxShadow: "0 6px 16px rgba(129, 22, 224, 0.35)" },
  seg: { boxShadow: "0 1px 2px rgba(21, 23, 36, 0.12)" },
} as const;
