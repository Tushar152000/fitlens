import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FITR8 — AI fitness coach",
    short_name: "FITR8",
    description:
      "Snap your meals, hit your goal. Calorie tracking and adaptive workouts for Indian food.",
    start_url: "/today",
    display: "standalone",
    background_color: "#F6F6F8",
    theme_color: "#8116E0",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
