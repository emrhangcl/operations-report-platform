"use client";
// Aceternity UI "container-scroll-animation-demo" birebir; metin Turkce, gorsel owner paneli.
import React from "react";
import { ContainerScroll } from "@/components/aceternity/container-scroll-animation";

export function LandingHero() {
  return (
    <div className="flex flex-col overflow-hidden">
      <ContainerScroll
        titleComponent={
          <>
            <h1 className="text-4xl font-semibold text-black dark:text-white">
              Atamadan imzalı rapora, saha işi <br />
              <span className="text-4xl md:text-[6rem] font-bold mt-1 leading-none">Tek Kayıtta</span>
            </h1>
          </>
        }
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- orijinal demo duz <img> kullanir */}
        <img
          src="/landing/owner-dashboard.png"
          alt="Operasyon Portalı yönetim paneli"
          height={720}
          width={1400}
          className="mx-auto rounded-2xl object-cover h-full object-left-top"
          draggable={false}
        />
      </ContainerScroll>
    </div>
  );
}
