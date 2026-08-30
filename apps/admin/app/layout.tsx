import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Operasyon Portalı",
  title: {
    default: "Operasyon Portalı",
    template: "%s | Operasyon Portalı"
  },
  description: "Montaj atamalarını, saha operasyonlarını ve kurumsal raporları tek çalışma alanında yönetin.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/operations-app-icon.png",
    apple: "/operations-app-icon.png"
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Operasyon Portalı"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e"
};

const vercelObservabilityEnabled =
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true" || Boolean(process.env.VERCEL);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>
        {children}
        {vercelObservabilityEnabled ? (
          <>
            <Analytics />
            <SpeedInsights />
          </>
        ) : null}
      </body>
    </html>
  );
}
