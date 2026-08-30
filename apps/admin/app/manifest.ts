import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Operasyon Portalı",
    short_name: "Operasyon",
    description: "Montaj, saha operasyonu ve rapor yönetim sistemi.",
    start_url: "/personel",
    scope: "/",
    display: "standalone",
    background_color: "#f3f6f5",
    theme_color: "#0f766e",
    icons: [
      {
        src: "/operations-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any"
      },
      {
        src: "/operations-app-icon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable"
      }
    ]
  };
}
