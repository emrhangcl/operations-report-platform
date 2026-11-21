import { Item, ItemContent, ItemDescription, ItemGroup, ItemMedia, ItemTitle } from "@/components/shadcn/item";
import { MarketingHeading, MarketingShell } from "../../components/marketing-shell";

const steps = [
  ["01", "Planla", "Firma, hat, bant ve sorumlu personeli seçerek işi net bir kapsamla atayın."],
  ["02", "Sahada tamamla", "Ekip zamanları, yapılan işlemleri, kilometreleri ve fotoğrafları telefondan girsin."],
  ["03", "Kontrol et ve teslim et", "Raporu değişmez kayıt olarak saklayın; PDF veya Excel çıktısını müşteriyle paylaşın."]
];

// Adim listesi shadcn "item-demo" (Item variant="outline").
export default function WorkflowPage() {
  return (
    <MarketingShell>
      <MarketingHeading
        description="Her operasyon aynı adımlarla ilerlesin; ekip ve yöneticiler güncel durumu tek kayıt üzerinden takip etsin."
        title="Saha işi, kontrol ve teslim adımlarını netleştirin"
      />
      <ItemGroup className="mx-auto mt-10 max-w-7xl gap-4 px-4">
        {steps.map(([number, title, text]) => (
          <Item className="bg-background" key={number} variant="outline">
            <ItemMedia className="font-mono text-sm text-muted-foreground">{number}</ItemMedia>
            <ItemContent>
              <ItemTitle>{title}</ItemTitle>
              <ItemDescription>{text}</ItemDescription>
            </ItemContent>
          </Item>
        ))}
      </ItemGroup>
    </MarketingShell>
  );
}
