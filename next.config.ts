import type { NextConfig } from "next";

// Lets a phone reach the dev server through a Cloudflare quick tunnel (https://*.trycloudflare.com)
// or directly over Wi-Fi. Development only.
const devHosts = process.env.NODE_ENV === "development" ? ["*.trycloudflare.com", "192.168.*.*"] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: devHosts,
  experimental: {
    serverActions: { allowedOrigins: devHosts },
  },
};

export default nextConfig;
