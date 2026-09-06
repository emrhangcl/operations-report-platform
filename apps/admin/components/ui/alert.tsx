import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./utils";

type AlertTone = "info" | "success" | "warning" | "error";

type AlertProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  tone?: AlertTone;
};

export function Alert({ children, className, tone = "info", ...props }: AlertProps) {
  const role = tone === "error" || tone === "warning" ? "alert" : "status";

  return (
    <div className={cn("message", tone, className)} role={role} {...props}>
      {children}
    </div>
  );
}
