/** "Warm Athletic" tokens from docs/DESIGN.md. Keep in step with src/app/globals.css on the web. */
export const colors = {
  ground: "#f6f3ec",
  surface: "#ffffff",
  sunken: "#f3efe7",
  track: "#f0ebe1",
  line: "#e2ddd2",
  lineStrong: "#d9d3c7",
  ink: "#17181c",
  ink2: "#4a4d55",
  ink3: "#6b6e76",
  brand: "#c2410c",
  brandHover: "#9a3412",
  brandGlow: "#e8772e",
  protein: "#2f6b4f",
  proteinSoft: "#ddebe3",
  carbs: "#e3a13b",
  carbsText: "#9a6212",
  fat: "#6d4fb0",
  caution: "#e8a15c",
  cautionSoft: "#fdebd3",
  cautionText: "#8a3c08",
  water: "#2f6f9f", // water card and bar; text-safe on ground and surface
  waterSoft: "#dde9f2",
  chip: "#eae5da",
  dash: "#c9c2b4",
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
  fab: { boxShadow: "0 6px 16px rgba(194, 65, 12, 0.35)" },
  seg: { boxShadow: "0 1px 2px rgba(23, 24, 28, 0.12)" },
} as const;
