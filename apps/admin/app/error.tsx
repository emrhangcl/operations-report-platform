"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { StatusEmpty } from "../components/public-info-page";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background p-4 text-foreground" data-ui="v2">
      <StatusEmpty
        action={<Button onClick={reset} type="button"><RotateCcw aria-hidden /> Yeniden Dene</Button>}
        description="Beklenmeyen bir hata oluştu. Hassas teknik ayrıntılar bu ekranda gösterilmez."
        icon={AlertTriangle}
        title="İşlem Tamamlanamadı"
      />
    </main>
  );
}
