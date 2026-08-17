import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ForkCast",
    short_name: "ForkCast",
    description: "ForkCast — recipes, meal planning, food inventory, and shopping in one place.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e0",
    theme_color: "#14264a",
    icons: [
      {
        src: "/icon",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
