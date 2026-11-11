import type { NextConfig } from "next";

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
