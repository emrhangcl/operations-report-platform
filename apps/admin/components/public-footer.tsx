import Link from "next/link";

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-footer-inner">
        <div>
          <strong>TUNCA Rapor Sistemi</strong>
          <span>Montaj ve saha raporlarının güvenli çalışma alanı.</span>
        </div>
        <nav aria-label="Alt menü">
          <Link href="/privacy">Gizlilik ve KVKK</Link>
          <Link href="/terms">Kullanım ve Abonelik</Link>
          <Link href="/contact">İletişim</Link>
        </nav>
      </div>
    </footer>
  );
}
