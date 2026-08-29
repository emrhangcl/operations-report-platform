import Link from "next/link";
import { TuncaLogo } from "./logo";

export function AuthShell({
  children,
  description,
  footer,
  title
}: {
  children: React.ReactNode;
  description?: string;
  footer?: React.ReactNode;
  title: string;
}) {
  return (
    <main className="public-auth-page">
      <Link aria-label="Ana sayfa" className="public-auth-brand" href="/">
        <TuncaLogo />
      </Link>
      <section className="public-auth-panel">
        <header>
          <h1>{title}</h1>
          {description ? <p>{description}</p> : null}
        </header>
        {children}
        {footer ? <footer>{footer}</footer> : null}
      </section>
    </main>
  );
}
