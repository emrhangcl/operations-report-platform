import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type EmptyStateProps = HTMLAttributes<HTMLDivElement> & {
  action?: ReactNode;
  children?: ReactNode;
  title?: ReactNode;
};

export function EmptyState({ action, children, className, title, ...props }: EmptyStateProps) {
  return (
    <div className={cn("empty empty-state", className)} {...props}>
      {title ? <strong>{title}</strong> : null}
      {children ? <p>{children}</p> : null}
      {action}
    </div>
  );
}
