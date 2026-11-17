/**
 * FITR8 tokens from docs/DESIGN.md (light keeps step with apps/web/src/app/globals.css).
 *
 * Two palettes with the same keys. Components read the active one with `useColors()` (or build
 * styles with `makeStyles`), never by importing a palette directly, so the whole app follows the
 * phone's appearance or the user's choice in Profile (lib/appearance.tsx).
 *
 * Dark palette rules (see docs/DESIGN.md "Dark mode"):
 * - Not an inversion. Neutrals keep the light palette's cool blue-violet hue (~235°), so the brand
 *   purple stays the one warm-leaning accent; the ground is near-black, never #000 (OLED smear,
 *   halation of white text).
 * - Elevation is lightness: ground < surface < sunken (wells, pressed rows) < panel (feature cards).
 * - Saturated colours shift lighter and slightly desaturated so they read on dark without vibrating;
 *   every text pair keeps WCAG AA (>= 4.5:1), most >= 7:1.
 * - Ink is off-white (#eceef5), not pure white, to avoid glare on large text.
 * - `brand` stays a fill (white text on it >= 5:1); accent TEXT on dark surfaces uses `brandText`.
 */
const light = {
  ground: "#f6f6f8",
  surface: "#ffffff",
  sunken: "#f0f0f5",
  /** Raised control on a chip/track (selected segment): white in light, lifted grey in dark. */
  raised: "#ffffff",
  track: "#ececf2",
  line: "#e3e3ea",
  lineStrong: "#d4d4de",
  ink: "#151724",
  ink2: "#4a4c5a",
  ink3: "#6b6d7a",
  brand: "#8116e0",
  brandHover: "#6a0fbd",
  brandGlow: "#a855f7",
  /** Brand-coloured text and icons on ground/surface (links, selected states). */
  brandText: "#8116e0",
  /** Tinted brand background (selected chips, highlights). */
  brandSoft: "#f1e6fd",
  protein: "#2f6b4f",
  proteinSoft: "#ddebe3",
  carbs: "#e3a13b",
  carbsText: "#9a6212",
  fat: "#c0396b",
  caution: "#e8a15c",
  cautionSoft: "#fdebd3",
  cautionText: "#8a3c08",
  danger: "#c0392b",
  water: "#2f6f9f", // water card and bar; text-safe on ground and surface
  waterSoft: "#dde9f2",
  chip: "#ebebf1",
  dash: "#c4c4d0",
  /** The dark feature card ("dark card" in the design) and dark screens. White text on it. */
  panel: "#151724",
  /** Hairline around `panel` (invisible in light, separates it from the ground in dark). */
  panelLine: "rgba(255,255,255,0)",
  /** Strong button: the highest-contrast fill against the ground, and its text. */
  strong: "#151724",
  strongHover: "#2c2e34",
  onStrong: "#ffffff",
  /** Behind bottom sheets and dialogs. */
  scrim: "rgba(23,24,28,0.45)",
  /** Always white: text/icons on brand, panel, photos and the camera. */
  white: "#ffffff",
} as const;

export type Colors = { readonly [K in keyof typeof light]: string };
export type ColorScheme = "light" | "dark";

const dark: Colors = {
  ground: "#0e0f15",
  surface: "#181a23",
  sunken: "#20222c",
  raised: "#363848",
  track: "#272935",
  line: "#2a2c38",
  lineStrong: "#3a3c4a",
  ink: "#eceef5",
  ink2: "#b6b8c7",
  ink3: "#9092a3",
  brand: "#8b3ff0",
  brandHover: "#7a2fd8",
  brandGlow: "#b98af8",
  brandText: "#c09cfa",
  brandSoft: "#2a1d45",
  protein: "#5fc490",
  proteinSoft: "#16301f",
  carbs: "#e8ad52",
  carbsText: "#f0bd6a",
  fat: "#ec7aa2",
  caution: "#eba765",
  cautionSoft: "#3a2916",
  cautionText: "#f5be86",
  danger: "#f07a6d",
  water: "#6eb1e0",
  waterSoft: "#14283a",
  chip: "#252733",
  dash: "#4b4d5c",
  panel: "#2a2342",
  panelLine: "rgba(255,255,255,0.08)",
  strong: "#eceef5",
  strongHover: "#d4d6e0",
  onStrong: "#151724",
  scrim: "rgba(0,0,0,0.6)",
  white: "#ffffff",
};

export const palettes: Record<ColorScheme, Colors> = { light, dark };

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
export type Shadows = { readonly fab: { boxShadow: string }; readonly seg: { boxShadow: string } };
const shadowSets: Record<ColorScheme, Shadows> = {
  light: {
    fab: { boxShadow: "0 6px 16px rgba(129, 22, 224, 0.35)" },
    seg: { boxShadow: "0 1px 2px rgba(21, 23, 36, 0.12)" },
  },
  dark: {
    // Shadows barely read on dark; a softer brand glow keeps the FAB lifted.
    fab: { boxShadow: "0 6px 18px rgba(139, 63, 240, 0.30)" },
    seg: { boxShadow: "0 1px 2px rgba(0, 0, 0, 0.5)" },
  },
};
export const shadowsFor = (scheme: ColorScheme): Shadows => shadowSets[scheme];
