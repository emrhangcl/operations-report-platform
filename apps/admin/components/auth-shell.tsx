import Image from "next/image";
import Link from "next/link";
import { IconInnerShadowTop } from "@tabler/icons-react";
import { cn } from "@/lib/utils";

// shadcn "login-02" / "signup-02" blogu birebir: solda logo ve form, sagda gorsel.
// Farklar: logo kutusuz Operasyon Portali isareti (panellerle ayni), sagdaki yer tutucu
// gorselin yerine firma paneli ekran goruntusu. Baslik ve aciklama formun ustunde ortali.
export function AuthShell({
  children,
  description,
  footer,
  title,
  wide = false
}: {
  children: React.ReactNode;
  description?: string;
  footer?: React.ReactNode;
  title: string;
  wide?: boolean;
}) {
  return (
    <div className="min-h-svh bg-background text-foreground" data-ui="v2">
      <div className="grid min-h-svh lg:grid-cols-2">
        <div className="flex flex-col gap-4 p-6 md:p-10">
          <div className="flex justify-center gap-2 md:justify-start">
            <Link className="flex items-center gap-2 font-medium" href="/">
              <IconInnerShadowTop className="size-5" />
              Operasyon Portalı
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <main className={cn("w-full", wide ? "max-w-md" : "max-w-xs")}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-col items-center gap-1 text-center">
                  <h1 className="text-2xl font-bold">{title}</h1>
                  {description ? <p className="text-sm text-balance text-muted-foreground">{description}</p> : null}
                </div>
                {children}
                {footer ? <div className="text-center text-sm text-muted-foreground [&_a]:underline [&_a]:underline-offset-4">{footer}</div> : null}
              </div>
            </main>
          </div>
        </div>
        <div className="relative hidden bg-muted lg:block">
          <Image
            alt="Operasyon Portalı firma paneli"
            className="absolute inset-0 h-full w-full object-cover object-left-top dark:brightness-[0.2] dark:grayscale"
            fill
            priority
            sizes="50vw"
            src="/landing/firm-dashboard.png"
          />
        </div>
      </div>
    </div>
  );
}
