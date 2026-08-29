import { PublicFooter } from "./public-footer";
import { PublicHeader } from "./public-header";

export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-site">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}
