import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Item, ItemActions, ItemContent, ItemDescription, ItemGroup, ItemTitle } from "@/components/shadcn/item";
import { MarketingHeading, MarketingShell } from "../../components/marketing-shell";

const startOptions = [
  { title: "Firma hesabını oluşturun", text: "Firma bilgilerinizi ve ilk yetkili kullanıcıyı kaydedin.", href: "/register", action: "Firma Kaydı" },
  { title: "Mevcut hesabınızla girin", text: "Yönetici veya personel hesabınızla çalışma alanına devam edin.", href: "/login", action: "Giriş Yap" },
  { title: "Paketleri inceleyin", text: "Firmanızın kullanım dönemine uygun aktif paketleri karşılaştırın.", href: "/pricing", action: "Paketleri Gör" }
];

// Secenek listesi shadcn "item-demo" (Item + ItemActions).
export default function StartPage() {
  return (
    <MarketingShell>
      <MarketingHeading
        description="Yeni firma kaydı oluşturun veya mevcut hesabınızla güvenli biçimde giriş yapın."
        title="Operasyon çalışma alanınızı açın"
      />
      <ItemGroup className="mx-auto mt-10 max-w-7xl gap-4 px-4">
        {startOptions.map((option) => (
          <Item className="bg-background" key={option.href} variant="outline">
            <ItemContent>
              <ItemTitle>{option.title}</ItemTitle>
              <ItemDescription>{option.text}</ItemDescription>
            </ItemContent>
            <ItemActions>
              <Button asChild size="sm" variant="outline">
                <Link href={option.href}>{option.action} <ChevronRightIcon /></Link>
              </Button>
            </ItemActions>
          </Item>
        ))}
      </ItemGroup>
    </MarketingShell>
  );
}
