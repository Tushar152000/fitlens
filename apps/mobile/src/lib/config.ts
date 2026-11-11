/**
 * The FITR8 API (NestJS) the app talks to directly. Set EXPO_PUBLIC_API_URL in apps/mobile/.env to
 * point at a local API (e.g. http://192.168.1.5:4000); builds default to the deployed API.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? "https://api.fitr8.com").replace(/\/$/, "");
