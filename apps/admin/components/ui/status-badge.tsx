import type { HTMLAttributes } from "react";
import { cn } from "./utils";

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "pending";

type StatusBadgeProps = HTMLAttributes<HTMLSpanElement> & {
  label: string;
  tone?: StatusTone;
};

export function StatusBadge({ className, label, tone = "neutral", ...props }: StatusBadgeProps) {
  return (
    <span className={cn("status", `status-${tone}`, className)} {...props}>
      {label}
    </span>
  );
}
