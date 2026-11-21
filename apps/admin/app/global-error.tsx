"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { StatusEmpty } from "../components/public-info-page";
import "./styles.css";

export default function GlobalError() {
  return (
    <html lang="tr">
      <body>
        <main className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground" data-ui="v2">
          <StatusEmpty
            action={<Button onClick={() => window.location.reload()} type="button"><RotateCcw aria-hidden /> Yeniden Dene</Button>}
            description="Beklenmeyen bir hata oluştu. Teknik ayrıntılar güvenlik nedeniyle gösterilmez."
            icon={AlertTriangle}
            title="Hizmet geçici olarak kullanılamıyor"
          />
        </main>
      </body>
    </html>
  );
}
