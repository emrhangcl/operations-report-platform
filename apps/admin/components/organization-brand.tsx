"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { loadAccountContext, type AccountScope } from "../lib/account-context-client";
import { ProductBrand } from "./logo";

interface BrandingPayload {
  organizationName: string;
  logoUrl: string | null;
}

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
    <span className="organization-brand-lockup">
      <span className="organization-logo-frame">
        <Image
          alt={`${branding.organizationName} logosu`}
          height={48}
          onError={() => setBranding({ ...branding, logoUrl: null })}
          src={branding.logoUrl}
          unoptimized
          width={132}
        />
      </span>
      <span className="organization-brand-copy">
        <strong>{branding.organizationName}</strong>
        <span>Operasyon Portalı</span>
      </span>
    </span>
  );
}
