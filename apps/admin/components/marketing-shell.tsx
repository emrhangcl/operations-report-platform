import { MinimalFooter } from "@/components/21st/minimal-footer";
import { LandingNavbar } from "@/components/landing/landing-navbar";
import { cn } from "@/lib/utils";

// Ana sayfayla ayni kabuk: Aceternity Resizable Navbar + 21st.dev Minimal Footer.
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh w-full flex-col bg-neutral-100 font-sans text-black antialiased" data-ui="v2">
      <LandingNavbar />
      <main className="flex-1 pt-28 pb-20">{children}</main>
      <MinimalFooter />
    </div>
  );
}

// shadcn Typography: h1 + lead paragrafi.
export function MarketingHeading({ className, description, title }: { className?: string; description?: string; title: string }) {
  return (
    <div className={cn("mx-auto max-w-7xl px-4", className)}>
      <h1 className="scroll-m-20 text-4xl font-extrabold tracking-tight text-balance">{title}</h1>
      {description ? <p className="mt-4 max-w-2xl text-xl text-muted-foreground">{description}</p> : null}
    </div>
  );
}
