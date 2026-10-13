import { Inter, Playfair_Display, Roboto } from "next/font/google";

// Fonts of the FITR8 marketing site and web welcome flow. Loaded only by those layouts, so the app
// (Bricolage + Figtree, docs/DESIGN.md) doesn't download them.
const inter = Inter({
  variable: "--font-inter-var",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});
const playfair = Playfair_Display({
  variable: "--font-playfair-var",
  subsets: ["latin"],
  weight: ["500"],
  style: ["italic"],
});
const roboto = Roboto({ variable: "--font-roboto-var", subsets: ["latin"], weight: ["700"] });

/** Put on the layout root; pair with the `font-inter` utility. */
export const fitr8FontVars = `${inter.variable} ${playfair.variable} ${roboto.variable}`;
