"use client";

import Image from "next/image";
import { useState } from "react";

export function TuncaLogo() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div className="brand-fallback">
        <strong>TUNCA</strong>
        <span>Montaj ve Tamir Rapor Sistemi</span>
      </div>
    );
  }

  return (
    <Image
      src="/tunca-logo.png"
      alt="TUNCA"
      width={180}
      height={48}
      priority
      onError={() => setFailed(true)}
    />
  );
}
