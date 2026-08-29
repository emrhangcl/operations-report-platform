import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import { MarketingShell } from "./marketing-shell";

export function PublicInfoPage({
  actionHref = "/",
  actionLabel = "Ana sayfaya dön",
  description,
  icon: Icon,
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
      <section className="public-status-page">
        <Icon aria-hidden size={32} />
        <h1>{title}</h1>
        <p>{description}</p>
        <Link className="button" href={actionHref}>{actionLabel}</Link>
      </section>
    </MarketingShell>
  );
}
