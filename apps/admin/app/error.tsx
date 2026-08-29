"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="public-status-page standalone-error">
      <AlertTriangle aria-hidden size={32} />
      <h1>İşlem Tamamlanamadı</h1>
      <p>Beklenmeyen bir hata oluştu. Hassas teknik ayrıntılar bu ekranda gösterilmez.</p>
      <button className="button" onClick={reset} type="button"><RotateCcw aria-hidden size={18} /> Yeniden Dene</button>
    </main>
  );
}
