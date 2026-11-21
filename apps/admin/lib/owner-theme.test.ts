import { describe, expect, it } from "vitest";
import {
  OWNER_THEME_STORAGE_KEY,
  ownerThemeBootScript,
  readOwnerTheme,
  resolveOwnerTheme,
  writeOwnerTheme
} from "./owner-theme";

describe("owner theme preference", () => {
  it("defaults to dark when nothing is stored", () => {
    expect(resolveOwnerTheme(null)).toBe("dark");
    expect(resolveOwnerTheme(undefined)).toBe("dark");
  });

  it("keeps a valid stored choice", () => {
    expect(resolveOwnerTheme("light")).toBe("light");
    expect(resolveOwnerTheme("dark")).toBe("dark");
  });

  it("falls back to dark for an unknown stored value", () => {
    expect(resolveOwnerTheme("blue")).toBe("dark");
  });

  it("opens dark when storage is unavailable or throws", () => {
    expect(readOwnerTheme(null)).toBe("dark");
    expect(readOwnerTheme({ getItem: () => { throw new Error("blocked"); } })).toBe("dark");
  });

  it("reads the stored choice under the owner-theme key", () => {
    expect(readOwnerTheme({ getItem: (key) => (key === OWNER_THEME_STORAGE_KEY ? "light" : null) })).toBe("light");
  });

  it("does not throw when saving fails", () => {
    expect(() => writeOwnerTheme({ setItem: () => { throw new Error("quota"); } }, "light")).not.toThrow();
    expect(() => writeOwnerTheme(null, "light")).not.toThrow();
  });

  it("boot script reads the same storage key", () => {
    expect(OWNER_THEME_STORAGE_KEY).toBe("owner-theme");
    expect(ownerThemeBootScript).toContain("owner-theme");
  });
});
