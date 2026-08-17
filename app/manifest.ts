import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ForkCast",
    short_name: "ForkCast",
    description: "ForkCast — recipes, meal planning, food inventory, and shopping in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#f5efd9",
    theme_color: "#1a4638",
    icons: [
      {
        src: "/icon.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
