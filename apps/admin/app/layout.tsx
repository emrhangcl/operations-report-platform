import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { NavigationFeedback } from "../components/navigation-feedback";
import { RouteShell } from "../components/route-shell";
import "./styles.css";

const displayFont = Space_Grotesk({ subsets: ["latin"], variable: "--source-font-display", weight: ["400", "500", "600", "700"] });
const bodyFont = IBM_Plex_Sans({ subsets: ["latin"], variable: "--source-font-body", weight: ["400", "500", "600", "700"] });
// v2 (shadcn) arayuzunun fontu: Vercel'in resmi `geist` paketi, dosyayi paketle birlikte
// kendi sunucumuzdan sunar (CSP font-src 'self'; Google Fonts istegi yok).
const geistSans = GeistSans;

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
  themeColor: "#11151c"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={`${displayFont.variable} ${bodyFont.variable} ${geistSans.variable}`} data-scroll-behavior="smooth" lang="tr" suppressHydrationWarning>
      <body>
        <NavigationFeedback />
        <RouteShell>{children}</RouteShell>
      </body>
    </html>
  );
}
