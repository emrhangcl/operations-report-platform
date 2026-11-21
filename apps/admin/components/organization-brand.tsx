"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { loadAccountContext, type AccountScope } from "../lib/account-context-client";
import { ProductBrand } from "./logo";

interface BrandingPayload {
  organizationName: string;
  logoUrl: string | null;
}

// Firma logosu varsa logo + firma adi, yoksa urun isareti. ProductBrand gibi parcalari
// dogrudan ebeveynin cocugu olarak verir (SidebarMenuButton / flex kap).
export function OrganizationBrand({ scope = "admin" }: { scope?: AccountScope }) {
  const [branding, setBranding] = useState<BrandingPayload | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const payload = await loadAccountContext(scope);
        if (active) setBranding(payload);
      } catch {
        // The default product mark remains visible when branding cannot be loaded.
      }
    }

    void load();
    return () => { active = false; };
  }, [scope]);

  if (!branding?.logoUrl) {
    return <ProductBrand />;
  }

  return (
    <>
      <Image
        alt={`${branding.organizationName} logosu`}
        className="h-5 w-auto max-w-20 shrink-0 object-contain"
        height={20}
        onError={() => setBranding({ ...branding, logoUrl: null })}
        src={branding.logoUrl}
        unoptimized
        width={56}
      />
      <span className="truncate text-base font-semibold">{branding.organizationName}</span>
    </>
  );
}
