"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getBrowserSupabase } from "../lib/supabase-browser";

type PublicPlan = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  currency: string;
  monthly_price_minor: number | null;
  yearly_price_minor: number | null;
};

function price(value: number | null, currency: string) {
  if (value === null) return null;
  return new Intl.NumberFormat("tr-TR", {
    style: "currency",
    currency,
    maximumFractionDigits: 2
  }).format(value / 100);
}

export function PricingSection({ standalone = false }: { standalone?: boolean }) {
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getBrowserSupabase();
    if (!supabase) {
      setMessage("Paket bilgileri şu anda alınamıyor.");
      setLoading(false);
      return;
    }

    supabase
      .from("plans")
      .select("id,code,name,description,currency,monthly_price_minor,yearly_price_minor")
      .eq("is_active", true)
      .eq("is_public", true)
      .order("monthly_price_minor", { ascending: true, nullsFirst: false })
      .then(({ data, error }) => {
        if (error) setMessage("Paket bilgileri şu anda alınamıyor.");
        else setPlans((data ?? []) as PublicPlan[]);
        setLoading(false);
      });
  }, []);

  return (
    <section className={standalone ? "public-band pricing-standalone" : "public-band public-band-soft"} id="paketler">
      <div className="public-container">
        <div className="public-section-heading">
          <span>Paketler</span>
          <h2>Aylık veya yıllık kullanım</h2>
          <p>Yalnızca sistemde aktif ve satışa açık olarak tanımlanan gerçek paketler burada gösterilir.</p>
        </div>
        {loading ? <div className="public-empty">Paketler yükleniyor...</div> : null}
        {!loading && message ? <div className="public-empty">{message}</div> : null}
        {!loading && !message && plans.length === 0 ? (
          <div className="public-empty">
            <strong>Henüz satışa açık paket bulunmuyor.</strong>
            <span>Paket ve ödeme sağlayıcısı tanımlandığında fiyatlar bu alanda yayınlanacak.</span>
            <Link className="button secondary" href="/contact">Satış ile iletişime geç</Link>
          </div>
        ) : null}
        <div className="pricing-grid">
          {plans.map((plan) => {
            const monthly = price(plan.monthly_price_minor, plan.currency);
            const yearly = price(plan.yearly_price_minor, plan.currency);
            return (
              <article className="pricing-card" key={plan.id}>
                <div>
                  <span className="plan-code">{plan.code}</span>
                  <h3>{plan.name}</h3>
                  <p>{plan.description || "Paket açıklaması henüz eklenmedi."}</p>
                </div>
                <dl>
                  <div><dt>Aylık</dt><dd>{monthly ?? "Tanımlanmadı"}</dd></div>
                  <div><dt>Yıllık</dt><dd>{yearly ?? "Tanımlanmadı"}</dd></div>
                </dl>
                <div className="pricing-actions">
                  {monthly ? <Link className="button" href={`/register?plan=${plan.id}&interval=monthly`}>Aylık Başla</Link> : null}
                  {yearly ? <Link className="button secondary" href={`/register?plan=${plan.id}&interval=yearly`}>Yıllık Başla</Link> : null}
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
