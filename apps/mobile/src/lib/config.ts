/**
 * The FitLens server the app talks to. Set EXPO_PUBLIC_API_URL in apps/mobile/.env to point at a local
 * dev server (e.g. http://192.168.1.5:3000); builds default to the deployed site.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://fitlens-mocha.vercel.app").replace(/\/$/, "");
