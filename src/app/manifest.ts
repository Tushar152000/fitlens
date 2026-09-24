import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FitLens — AI fitness coach",
    short_name: "FitLens",
    description: "Snap your meals, hit your goal. Calorie tracking and adaptive workouts for Indian food.",
    start_url: "/today",
    display: "standalone",
    background_color: "#F6F3EC",
    theme_color: "#17181C",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
