import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./utils";

type ButtonVariant = "primary" | "secondary" | "subtle" | "danger";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon?: ReactNode;
  variant?: ButtonVariant;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    children,
    className,
    icon,
    variant = "primary",
    type = "button",
    ...props
  },
  ref
) {
  return (
    <button
      className={cn("button", variant !== "primary" && variant, className)}
      ref={ref}
      type={type}
      {...props}
    >
      {icon}
      {children}
    </button>
  );
});

type IconButtonProps = Omit<ButtonProps, "children" | "icon"> & {
  "aria-label": string;
  icon: ReactNode;
};

export function IconButton({ className, icon, variant = "secondary", ...props }: IconButtonProps) {
  return (
    <Button
      className={cn("icon-only", className)}
      variant={variant}
      {...props}
    >
      {icon}
    </Button>
  );
}
