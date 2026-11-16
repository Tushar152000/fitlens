/**
 * The FITR8 API (NestJS) the app talks to directly. In development `pnpm dev:mobile` sets
 * EXPO_PUBLIC_API_URL to this laptop's API (scripts/local.mjs); builds set it in eas.json. Unset =
 * the deployed API.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://api.fitr8.com").replace(/\/$/, "");
