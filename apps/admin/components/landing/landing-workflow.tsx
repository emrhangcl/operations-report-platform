"use client";
// Aceternity UI "sticky-scroll-reveal-demo" birebir; dort adim urunun gercek is akisi.
import React from "react";
import { StickyScroll } from "@/components/aceternity/sticky-scroll-reveal";

const content = [
  {
    title: "Atama",
    description:
      "İşi doğru firma, hat, bant ve sorumlu personele bağlayın. Kimin hangi işte olduğu, ne zaman başlayacağı ve hangi ekipmanla çalışacağı tek ekranda görünür.",
    content: (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(to_bottom_right,var(--cyan-500),var(--emerald-500))] text-white">
        Atama
      </div>
    ),
  },
  {
    title: "Saha kaydı",
    description:
      "Personel zamanı, yapılan işlemi, kilometreyi ve fotoğrafları telefondan kaydeder. Kayıtlar anında yöneticinin ekranına düşer; mesaj trafiğinde kaybolan bilgi kalmaz.",
    content: (
      <div className="flex h-full w-full items-center justify-center text-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- orijinal demo duz <img> kullanir */}
        <img
          src="/technician.jpg"
          width={300}
          height={300}
          className="h-full w-full object-cover"
          alt="Sahada çalışan teknisyen"
        />
      </div>
    ),
  },
  {
    title: "Müşteri onayı",
    description:
      "İş bitince müşteri imzası ve teslim onayı aynı kayda eklenir. Kim, ne zaman, neyi onayladı sorusunun cevabı her zaman raporun içindedir.",
    content: (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(to_bottom_right,var(--orange-500),var(--yellow-500))] text-white">
        Müşteri onayı
      </div>
    ),
  },
  {
    title: "Rapor çıktısı",
    description:
      "Tamamlanan iş, firma paylaşımına uygun PDF rapora dönüşür; yönetim listeleri Excel'e aktarılır. Raporu hazırlamak için ayrıca belge düzenlemeniz gerekmez.",
    content: (
      <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(to_bottom_right,var(--cyan-500),var(--emerald-500))] text-white">
        Rapor çıktısı
      </div>
    ),
  },
];

export function LandingWorkflow() {
  return (
    <div className="w-full py-4">
      <StickyScroll content={content} />
    </div>
  );
}
