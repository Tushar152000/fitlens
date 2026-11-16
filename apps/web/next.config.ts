import { existsSync } from "node:fs";
import { resolve } from "node:path";
import type { NextConfig } from "next";

// One env file for the whole repo: in local development the web reads the root .env too (values
// already in the shell win), and calls the API at the same API_PUBLIC_URL the API itself uses.
// Deployments (Vercel, Docker) set NEXT_PUBLIC_API_URL themselves and have no root .env.
const rootEnv = resolve(process.cwd(), "../../.env"); // next dev runs in apps/web
if (process.env.NODE_ENV !== "production" && existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
  process.env.NEXT_PUBLIC_API_URL ||= process.env.API_PUBLIC_URL;
}

// Lets a phone reach the dev server through a Cloudflare quick tunnel (https://*.trycloudflare.com)
// or directly over Wi-Fi. Development only.
const devHosts =
  process.env.NODE_ENV === "development" ? ["*.trycloudflare.com", "192.168.*.*"] : [];

// The web app is a pure client of @fitr8/api: no API routes, proxy or rewrites here. The browser
// calls the API directly at NEXT_PUBLIC_API_URL (src/lib/api-url.ts); server rendering uses
// API_INTERNAL_URL or the same address (src/lib/api-base.ts).
const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (apps/web/Dockerfile).
  output: "standalone",
  allowedDevOrigins: devHosts,
  experimental: {
    serverActions: { allowedOrigins: devHosts },
  },
};

export default nextConfig;
