import type { MetadataRoute } from "next";

// Icons are generated from lib/logo-mark.json by scripts/generate_icons.mjs.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Reminder Wall",
    short_name: "Wall",
    description: "Your reminders, on your wall.",
    start_url: "/",
    display: "standalone",
    background_color: "#0E1F31",
    theme_color: "#14283E",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
