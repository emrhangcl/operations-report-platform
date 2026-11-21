import Link from "next/link";
import { IconInnerShadowTop } from "@tabler/icons-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/shadcn/card";
import { FieldDescription } from "@/components/shadcn/field";

// shadcn "login-03" / "signup-03" blogu birebir: gri zemin, ustte logo, kart icinde form,
// kartin altinda kosullar notu. Fark: logo panellerle ayni Operasyon Portali isareti.
export function AuthShell({
  children,
  description,
  footer,
  legalNote = true,
  title
}: {
  children: React.ReactNode;
  description?: string;
  footer?: React.ReactNode;
  legalNote?: boolean;
  title: string;
}) {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted p-6 text-foreground md:p-10" data-ui="v2">
      <main className="flex w-full max-w-sm flex-col gap-6">
        <Link className="flex items-center gap-2 self-center font-medium" href="/">
          <IconInnerShadowTop className="size-5" />
          Operasyon Portalı
        </Link>
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-xl">
                <h1>{title}</h1>
              </CardTitle>
              {description ? <CardDescription>{description}</CardDescription> : null}
            </CardHeader>
            <CardContent className="flex flex-col gap-6">
              {children}
              {footer ? <FieldDescription className="text-center [&_a]:underline [&_a]:underline-offset-4">{footer}</FieldDescription> : null}
            </CardContent>
          </Card>
          {legalNote ? (
            <FieldDescription className="px-6 text-center">
              Devam ederek <Link href="/terms">Kullanım Şartları</Link> ve <Link href="/privacy">Gizlilik Politikası</Link>&apos;nı kabul etmiş olursunuz.
            </FieldDescription>
          ) : null}
        </div>
      </main>
    </div>
  );
}
