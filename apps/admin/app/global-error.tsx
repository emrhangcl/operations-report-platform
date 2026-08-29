"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError() {
  return (
    <html lang="tr">
      <body>
        <main className="public-status-page standalone-error">
          <AlertTriangle aria-hidden size={32} />
          <h1>Hizmet geçici olarak kullanılamıyor</h1>
          <p>Beklenmeyen bir hata oluştu. Teknik ayrıntılar güvenlik nedeniyle gösterilmez.</p>
          <button className="button" onClick={() => window.location.reload()} type="button">
            <RotateCcw aria-hidden size={18} /> Yeniden Dene
          </button>
        </main>
      </body>
    </html>
  );
}
