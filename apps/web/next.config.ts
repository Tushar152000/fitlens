import type { NextConfig } from "next";

// Lets a phone reach the dev server through a Cloudflare quick tunnel (https://*.trycloudflare.com)
// or directly over Wi-Fi. Development only.
const devHosts =
  process.env.NODE_ENV === "development" ? ["*.trycloudflare.com", "192.168.*.*"] : [];

// The web app is a pure client of @fitlens/api. The browser calls same-origin /api/*, which
// src/proxy.ts forwards to API_INTERNAL_URL at request time (not a next.config rewrite: those are
// fixed at build time, and the Docker image learns the API's address only when it starts).
const nextConfig: NextConfig = {
  // Self-contained server in .next/standalone for the Docker image (apps/web/Dockerfile).
  output: "standalone",
  allowedDevOrigins: devHosts,
  experimental: {
    serverActions: { allowedOrigins: devHosts },
    // Proxied /api requests: allow slow AI calls instead of cutting them at the 30 s default.
    proxyTimeout: 120_000,
  },
};

export default nextConfig;
