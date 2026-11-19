import localFont from "next/font/local";

// Fonts of the FITR8 marketing site and web welcome flow. Loaded only by those layouts, so the app
// (Bricolage + Figtree, docs/DESIGN.md) doesn't download them. The landing page uses Plus Jakarta
// Sans (docs/WEBSITE.md); the welcome flow keeps the Figma fonts until it is redesigned.
// Files live in src/fonts (Fontsource, OFL; see LICENSES.txt): builds never fetch from Google.
const inter = localFont({
  src: "../fonts/inter-latin-wght-normal.woff2",
  variable: "--font-inter-var",
  weight: "100 900",
  display: "swap",
});
const playfair = localFont({
  src: "../fonts/playfair-display-latin-wght-italic.woff2",
  variable: "--font-playfair-var",
  weight: "400 900",
  style: "italic",
  display: "swap",
});
const roboto = localFont({
  src: "../fonts/roboto-latin-700-normal.woff2",
  variable: "--font-roboto-var",
  weight: "700",
  display: "swap",
});

/** Put on the layout root; pair with the `font-inter` utility. */
export const fitr8FontVars = `${inter.variable} ${playfair.variable} ${roboto.variable}`;

// Variable font: every weight from 200 to 800 in one file.
const jakarta = localFont({
  src: "../fonts/plus-jakarta-sans-latin-wght-normal.woff2",
  variable: "--font-jakarta-var",
  weight: "200 800",
  display: "swap",
});

/** Landing page root; pair with the `font-jakarta` utility. */
export const marketingFontVars = jakarta.variable;
