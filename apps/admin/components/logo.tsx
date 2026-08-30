import { ClipboardCheck } from "lucide-react";

export function ProductBrand() {
  return (
    <span className="brand-lockup">
      <span aria-hidden className="brand-symbol">
        <ClipboardCheck size={22} strokeWidth={2.2} />
      </span>
      <span className="brand-copy">
        <strong>Operasyon Portalı</strong>
        <span>Saha ve rapor yönetimi</span>
      </span>
    </span>
  );
}
