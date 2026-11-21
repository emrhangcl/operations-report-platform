import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/shadcn/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/shadcn/empty";
import { MarketingShell } from "./marketing-shell";

// shadcn "empty-demo" yapisi: simge, baslik, aciklama ve eylem.
export function StatusEmpty({
  action,
  description,
  icon: Icon,
  title
}: {
  action?: React.ReactNode;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Icon />
        </EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  );
}

export function PublicInfoPage({
  actionHref = "/",
  actionLabel = "Ana sayfaya dön",
  description,
  icon,
  title
}: {
  actionHref?: string;
  actionLabel?: string;
  description: string;
  icon: LucideIcon;
  title: string;
}) {
  return (
    <MarketingShell>
      <div className="mx-auto flex min-h-[50svh] max-w-7xl items-center px-4">
        <StatusEmpty
          action={<Button asChild><Link href={actionHref}>{actionLabel}</Link></Button>}
          description={description}
          icon={icon}
          title={title}
        />
      </div>
    </MarketingShell>
  );
}
