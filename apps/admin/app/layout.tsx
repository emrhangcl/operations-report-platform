import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "TUNCA Rapor Sistemi",
  title: {
    default: "TUNCA Rapor Sistemi",
    template: "%s | TUNCA Rapor Sistemi"
  },
  description: "Montaj atamalarını, saha operasyonlarını ve kurumsal raporları tek çalışma alanında yönetin.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "TUNCA Rapor"
  }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#bd3332"
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
