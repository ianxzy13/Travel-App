import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vow – Wedding Planner",
    short_name: "Vow",
    description: "Plan your wedding, manage guests, and share trip details.",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6f2",
    theme_color: "#faf6f2",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
