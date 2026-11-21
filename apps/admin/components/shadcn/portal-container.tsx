"use client";

import * as React from "react";

// v2 token'lari ve koyu tema yalnizca [data-ui="v2"] kokunde tanimli. Radix portal'lari
// varsayilan olarak <body>'ye cizildigi icin bu kokun disinda kalir ve temasiz gorunur.
// Kok kendi elemanini bu context ile verir; portal kullanan shadcn bilesenleri oraya cizer.
const PortalContainerContext = React.createContext<HTMLElement | null>(null);

export function PortalContainerProvider({
  container,
  children
}: {
  container: HTMLElement | null;
  children: React.ReactNode;
}) {
  return <PortalContainerContext.Provider value={container}>{children}</PortalContainerContext.Provider>;
}

export function usePortalProps(): { container: HTMLElement } | Record<string, never> {
  const container = React.useContext(PortalContainerContext);
  return container ? { container } : {};
}
