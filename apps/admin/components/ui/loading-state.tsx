import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type LoadingStateProps = HTMLAttributes<HTMLDivElement> & {
  label?: ReactNode;
};

export function LoadingState({ className, label = "Yükleniyor...", ...props }: LoadingStateProps) {
  return (
    <div className={cn("loading-state", className)} role="status" {...props}>
      <span className="loading-spinner" aria-hidden />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("skeleton", className)} aria-hidden {...props} />;
}
