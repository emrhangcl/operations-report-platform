import { Badge } from "@/components/shadcn/badge";

// shadcn Typography (h1, lead, h2, list) ile taslak yasal metin.
export function LegalArticle({ intro, items, title }: { intro: string; items: string[]; title: string }) {
  return (
    <article className="mx-auto max-w-3xl px-4">
      <Badge variant="outline">Hukukçu onayı bekleyen taslak alan</Badge>
      <h1 className="mt-4 scroll-m-20 text-4xl font-extrabold tracking-tight text-balance">{title}</h1>
      <p className="mt-4 text-xl text-muted-foreground">{intro}</p>
      <h2 className="mt-10 scroll-m-20 border-b pb-2 text-3xl font-semibold tracking-tight">Doldurulması gereken bölümler</h2>
      <ul className="my-6 ml-6 list-disc [&>li]:mt-2">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </article>
  );
}
