import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { NavigationFeedback } from "../components/navigation-feedback";
import { RouteShell } from "../components/route-shell";
import "./globals.css";
import "./enterprise-system.css";

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
  themeColor: "#f6f6f7"
};

const vercelObservabilityEnabled =
  process.env.NEXT_PUBLIC_ENABLE_VERCEL_ANALYTICS === "true" || Boolean(process.env.VERCEL);

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html data-scroll-behavior="smooth" lang="tr" suppressHydrationWarning>
      <body>
        <NavigationFeedback />
        <RouteShell>{children}</RouteShell>
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
