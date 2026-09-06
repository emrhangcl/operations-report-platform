import type { ReactNode } from "react";

type PageHeaderShellProps = {
  action?: ReactNode;
  description: ReactNode;
  eyebrow?: ReactNode;
  title: ReactNode;
};

export function PageHeaderShell({ action, description, eyebrow, title }: PageHeaderShellProps) {
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <span className="page-header-eyebrow">{eyebrow}</span> : null}
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
