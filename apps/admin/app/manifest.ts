import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TUNCA Rapor Sistemi",
    short_name: "TUNCA Rapor",
    description: "TUNCA montaj ve tamir rapor sistemi.",
    start_url: "/personel",
    scope: "/",
    display: "standalone",
    background_color: "#f2f3f5",
    theme_color: "#bd3332",
    icons: [
      {
        src: "/tunca-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/tunca-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
