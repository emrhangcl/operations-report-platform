import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "TUNCA Rapor Sistemi",
  description: "TUNCA montaj ve tamir rapor yönetim paneli"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
