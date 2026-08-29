"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { TuncaLogo } from "./logo";

const links = [
  { href: "/features", label: "Özellikler" },
  { href: "/pricing", label: "Paketler" },
  { href: "/contact", label: "Destek" }
];

export function PublicHeader() {
  const [open, setOpen] = useState(false);

  return (
    <header className="public-header">
      <div className="public-header-inner">
        <Link aria-label="TUNCA Rapor Sistemi ana sayfa" className="public-brand" href="/">
          <TuncaLogo />
        </Link>
        <button
          aria-expanded={open}
          aria-label={open ? "Menüyü kapat" : "Menüyü aç"}
          className="public-menu-button"
          onClick={() => setOpen((current) => !current)}
          title={open ? "Menüyü kapat" : "Menüyü aç"}
          type="button"
        >
          {open ? <X aria-hidden size={22} /> : <Menu aria-hidden size={22} />}
        </button>
        <nav aria-label="Tanıtım menüsü" className={open ? "public-nav open" : "public-nav"}>
          {links.map((link) => (
            <Link href={link.href} key={link.href} onClick={() => setOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link className="public-login-link" href="/login" onClick={() => setOpen(false)}>
            Giriş
          </Link>
          <Link className="button public-register-link" href="/register" onClick={() => setOpen(false)}>
            Firma Kaydı
          </Link>
        </nav>
      </div>
    </header>
  );
}
