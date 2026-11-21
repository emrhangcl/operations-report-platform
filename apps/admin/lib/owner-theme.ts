// Owner (platform sahibi) panelinin acik/koyu tercihi. Panel varsayilan olarak koyu acilir;
// tercih yalnizca bu tarayicida saklanir. Depolamaya erisilemezse panel koyu acilir.

export const OWNER_THEME_STORAGE_KEY = "owner-theme";

export type OwnerTheme = "dark" | "light";

export function resolveOwnerTheme(stored: string | null | undefined): OwnerTheme {
  return stored === "light" ? "light" : "dark";
}

export function readOwnerTheme(storage: Pick<Storage, "getItem"> | null): OwnerTheme {
  try {
    return resolveOwnerTheme(storage?.getItem(OWNER_THEME_STORAGE_KEY));
  } catch {
    return "dark";
  }
}

export function writeOwnerTheme(storage: Pick<Storage, "setItem"> | null, theme: OwnerTheme): void {
  try {
    storage?.setItem(OWNER_THEME_STORAGE_KEY, theme);
  } catch {
    // Gizli pencere veya kota: tercih bu oturumla sinirli kalir.
  }
}

// Owner koku (#owner-root) ciziminden hemen sonra calisir ve React hydrate olmadan once
// dogru temayi uygular; acik tema secen kullanicida koyu->acik yanip sonmeyi onler.
export const ownerThemeBootScript = `(function(){try{var r=document.getElementById("owner-root");if(!r)return;var t=localStorage.getItem("${OWNER_THEME_STORAGE_KEY}");if(t==="light"){r.classList.remove("dark");}else{r.classList.add("dark");}}catch(e){}})();`;
