"use client";
// Aceternity UI "resizable-navbar-demo" birebir; baglantilar ve dugmeler Turkce. Bilesenin
// kendi notundaki gibi gercek sayfada `fixed` konumlanir (demo onizleme icin sticky kullanir).
import {
  Navbar,
  NavBody,
  NavItems,
  MobileNav,
  NavbarLogo,
  NavbarButton,
  MobileNavHeader,
  MobileNavToggle,
  MobileNavMenu,
} from "@/components/aceternity/resizable-navbar";
import { useState } from "react";

const navItems = [
  { name: "Özellikler", link: "/#ozellikler" },
  { name: "Fiyatlar", link: "/#fiyatlar" },
  { name: "İletişim", link: "/#iletisim" },
];

export function LandingNavbar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <Navbar className="fixed top-0">
      {/* Desktop Navigation */}
      <NavBody>
        <NavbarLogo />
        <NavItems items={navItems} />
        <div className="flex items-center gap-4">
          <NavbarButton href="/login" variant="secondary">
            Giriş Yap
          </NavbarButton>
          <NavbarButton href="/register" variant="primary">
            Firma Kaydı
          </NavbarButton>
        </div>
      </NavBody>

      {/* Mobile Navigation */}
      <MobileNav>
        <MobileNavHeader>
          <NavbarLogo />
          <MobileNavToggle isOpen={isMobileMenuOpen} onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} />
        </MobileNavHeader>

        <MobileNavMenu isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)}>
          {navItems.map((item, idx) => (
            <a
              key={`mobile-link-${idx}`}
              href={item.link}
              onClick={() => setIsMobileMenuOpen(false)}
              className="relative text-neutral-600 dark:text-neutral-300"
            >
              <span className="block">{item.name}</span>
            </a>
          ))}
          <div className="flex w-full flex-col gap-4">
            <NavbarButton href="/login" onClick={() => setIsMobileMenuOpen(false)} variant="primary" className="w-full">
              Giriş Yap
            </NavbarButton>
            <NavbarButton href="/register" onClick={() => setIsMobileMenuOpen(false)} variant="primary" className="w-full">
              Firma Kaydı
            </NavbarButton>
          </div>
        </MobileNavMenu>
      </MobileNav>
    </Navbar>
  );
}
