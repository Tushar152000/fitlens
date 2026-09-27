import type { NextConfig } from "next";

// Lets a phone reach the dev server through a Cloudflare quick tunnel (https://*.trycloudflare.com)
// or directly over Wi-Fi. Development only.
const devHosts = process.env.NODE_ENV === "development" ? ["*.trycloudflare.com", "192.168.*.*"] : [];

const nextConfig: NextConfig = {
  allowedDevOrigins: devHosts,
  experimental: {
    serverActions: { allowedOrigins: devHosts },
  },
  // Lets the Expo app's web preview (localhost:8081) call the API while developing.
  // The native app needs no CORS; production sends none.
  async headers() {
    if (process.env.NODE_ENV !== "development") return [];
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "http://localhost:8081" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, PATCH, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization" },
        ],
      },
    ];
  },
};

export default nextConfig;
