"use client";
// Firma paneli (v2) icin components/ui ile ayni API'yi sunan parcalar. Her biri shadcn/ui
// bileseninin kendisidir (Alert, Button, AlertDialog, Table, DropdownMenu, Badge, Label,
// Skeleton); tablo kabi ve basligi shadcn dashboard-01 DataTable'daki siniflarla ayni.
import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  useId,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode,
  type TableHTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes
} from "react";
import {
  IconAlertCircle,
  IconChevronDown,
  IconCircleCheck,
  IconCircleCheckFilled,
  IconInfoCircle,
  IconLoader
} from "@tabler/icons-react";
import { Alert as ShadcnAlert, AlertDescription } from "@/components/shadcn/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/shadcn/alert-dialog";
import { Badge } from "@/components/shadcn/badge";
import { Button as ShadcnButton } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/shadcn/dropdown-menu";
import { Label } from "@/components/shadcn/label";
import { Skeleton as ShadcnSkeleton } from "@/components/shadcn/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/shadcn/table";
import { cn } from "@/lib/utils";

const TEXT = "[&_input:not([type=checkbox]):not([type=radio])]";
// shadcn Input / Select / Textarea siniflari; sayfalardaki duz <input>, <select>, <textarea>
// elemanlari bu sinifi tasiyan bir kabin icinde ayni gorunumu alir.
export const controlClasses = cn(
  `${TEXT}:h-9 ${TEXT}:w-full ${TEXT}:min-w-0 ${TEXT}:rounded-md ${TEXT}:border ${TEXT}:border-input ${TEXT}:bg-transparent ${TEXT}:px-3 ${TEXT}:py-1 ${TEXT}:text-base ${TEXT}:shadow-xs ${TEXT}:outline-none md:${TEXT}:text-sm dark:${TEXT}:bg-input/30`,
  "[&_select]:h-9 [&_select]:w-full [&_select]:rounded-md [&_select]:border [&_select]:border-input [&_select]:bg-transparent [&_select]:px-3 [&_select]:py-1 [&_select]:text-sm [&_select]:shadow-xs [&_select]:outline-none dark:[&_select]:bg-input/30",
  "[&_textarea]:min-h-16 [&_textarea]:w-full [&_textarea]:rounded-md [&_textarea]:border [&_textarea]:border-input [&_textarea]:bg-transparent [&_textarea]:px-3 [&_textarea]:py-2 [&_textarea]:text-base [&_textarea]:shadow-xs [&_textarea]:outline-none md:[&_textarea]:text-sm dark:[&_textarea]:bg-input/30",
  "[&_input:focus-visible]:border-ring [&_input:focus-visible]:ring-[3px] [&_input:focus-visible]:ring-ring/50 [&_select:focus-visible]:border-ring [&_select:focus-visible]:ring-[3px] [&_select:focus-visible]:ring-ring/50 [&_textarea:focus-visible]:border-ring [&_textarea:focus-visible]:ring-[3px] [&_textarea:focus-visible]:ring-ring/50",
  "[&_input:disabled]:cursor-not-allowed [&_input:disabled]:opacity-50 [&_select:disabled]:cursor-not-allowed [&_select:disabled]:opacity-50 [&_input]:placeholder:text-muted-foreground [&_textarea]:placeholder:text-muted-foreground"
);

type AlertTone = "info" | "success" | "warning" | "error";
export function Alert({
  children,
  className,
  tone = "info",
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; tone?: AlertTone }) {
  const Icon = tone === "error" || tone === "warning" ? IconAlertCircle : tone === "success" ? IconCircleCheck : IconInfoCircle;
  return (
    <ShadcnAlert
      className={className}
      role={tone === "error" || tone === "warning" ? "alert" : "status"}
      variant={tone === "error" ? "destructive" : "default"}
      {...props}
    >
      <Icon />
      <AlertDescription>{children}</AlertDescription>
    </ShadcnAlert>
  );
}

type ButtonVariant = "primary" | "secondary" | "subtle" | "danger";
const buttonVariant = { primary: "default", secondary: "outline", subtle: "ghost", danger: "destructive" } as const;
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; variant?: ButtonVariant };
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { children, icon, variant = "primary", type = "button", ...props },
  ref
) {
  return (
    <ShadcnButton ref={ref} size="sm" type={type} variant={buttonVariant[variant]} {...props}>
      {icon}
      {children}
    </ShadcnButton>
  );
});

export function IconButton({
  icon,
  variant = "secondary",
  ...props
}: Omit<ButtonProps, "children" | "icon"> & { "aria-label": string; icon: ReactNode }) {
  return (
    <ShadcnButton className="size-8" size="icon" type="button" variant={buttonVariant[variant]} {...props}>
      {icon}
    </ShadcnButton>
  );
}

export function ConfirmDialog({
  cancelLabel = "Vazgeç",
  confirmLabel = "Onayla",
  confirmDisabled,
  description,
  onCancel,
  onConfirm,
  open,
  title
}: {
  cancelLabel?: string;
  confirmLabel?: string;
  confirmDisabled?: boolean;
  description?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
  open: boolean;
  title: ReactNode;
}) {
  return (
    <AlertDialog onOpenChange={(next) => { if (!next) onCancel(); }} open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-white hover:bg-destructive/90"
            disabled={confirmDisabled}
            onClick={(event) => {
              event.preventDefault();
              onConfirm();
            }}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function DataTablePanel({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("overflow-hidden rounded-lg border", className)} {...props}>{children}</div>;
}
export function DataTable({ children, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return <Table {...props}>{children}</Table>;
}
export function DataTableHeader({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <TableHeader className={cn("sticky top-0 z-10 bg-muted", className)} {...props}>{children}</TableHeader>;
}
export function DataTableBody({ children, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <TableBody {...props}>{children}</TableBody>;
}
export function DataTableRow({ children, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <TableRow {...props}>{children}</TableRow>;
}
export function DataTableHead({ children, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return <TableHead {...props}>{children}</TableHead>;
}
export function DataTableCell({ children, ...props }: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return <TableCell {...props}>{children}</TableCell>;
}

export function Dropdown({
  align = "end",
  children,
  className,
  label
}: HTMLAttributes<HTMLDivElement> & { align?: "start" | "end"; label: ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <ShadcnButton className={className} size="sm" variant="outline">
          {label}
          <IconChevronDown />
        </ShadcnButton>
      </DropdownMenuTrigger>
      <DropdownMenuContent align={align} className="w-56">{children}</DropdownMenuContent>
    </DropdownMenu>
  );
}
export function DropdownItem({
  children,
  disabled,
  onClick
}: ButtonHTMLAttributes<HTMLButtonElement> & { inset?: boolean }) {
  return (
    <DropdownMenuItem disabled={disabled} onSelect={() => onClick?.({} as never)}>
      {children}
    </DropdownMenuItem>
  );
}

export function EmptyState({
  action,
  children,
  className,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & { action?: ReactNode; children?: ReactNode; title?: ReactNode }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)} {...props}>
      {title ? <strong className="text-sm font-medium">{title}</strong> : null}
      {children ? <p className="max-w-md text-sm text-muted-foreground">{children}</p> : null}
      {action}
    </div>
  );
}

export function FormField({
  children,
  className,
  error,
  hint,
  htmlFor,
  label,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; error?: ReactNode; hint?: ReactNode; htmlFor?: string; label: ReactNode }) {
  const generatedId = useId().replace(/:/g, "");
  const childList = Children.toArray(children);
  const direct = childList.length === 1 && isValidElement(childList[0]) && typeof childList[0].type === "string" &&
    ["input", "select", "textarea"].includes(childList[0].type);
  const element = direct ? (childList[0] as ReactElement<{ id?: string }>) : null;
  const controlId = `field-${generatedId}`;
  const resolvedFor = htmlFor ?? element?.props.id ?? (element ? controlId : undefined);
  const resolvedChildren = element && !element.props.id ? cloneElement(element, { id: resolvedFor ?? controlId }) : children;
  const labelId = `field-label-${generatedId}`;
  return (
    <div
      aria-labelledby={resolvedFor ? undefined : labelId}
      className={cn("grid content-start gap-2", controlClasses, className)}
      role={resolvedFor ? undefined : "group"}
      {...props}
    >
      <Label htmlFor={resolvedFor} id={labelId}>{label}</Label>
      {resolvedChildren}
      {error ? <small className="text-sm text-destructive" role="alert">{error}</small> : null}
      {!error && hint ? <small className="text-sm text-muted-foreground">{hint}</small> : null}
    </div>
  );
}
export function FormSection({
  children,
  className,
  title,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode; title?: ReactNode }) {
  return (
    <section className={cn("grid gap-4", className)} {...props}>
      {title ? <h2 className="text-sm font-medium">{title}</h2> : null}
      {children}
    </section>
  );
}
export function FormActions({ children, className, style, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)} style={style} {...props}>{children}</div>;
}
// Form alanlarini yan yana dizen izgara (eski .form-grid yerine).
export function FormGrid({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", className)}>{children}</div>;
}

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <ShadcnSkeleton className={className} {...props} />;
}
export function LoadingState({
  className,
  label = "Yükleniyor...",
  ...props
}: HTMLAttributes<HTMLDivElement> & { label?: ReactNode }) {
  return (
    <div aria-busy="true" className={cn("grid gap-3", className)} role="status" {...props}>
      <span className="sr-only">{label}</span>
      <ShadcnSkeleton className="h-9 w-full" />
      <ShadcnSkeleton className="h-9 w-full" />
      <ShadcnSkeleton className="h-9 w-2/3" />
    </div>
  );
}

export function PageHeaderShell({
  action,
  description,
  eyebrow,
  title
}: { action?: ReactNode; description: ReactNode; eyebrow?: ReactNode; title: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="grid gap-1">
        {eyebrow ? <span className="text-xs text-muted-foreground">{eyebrow}</span> : null}
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="flex items-center gap-2">{action}</div> : null}
    </div>
  );
}

type StatusTone = "neutral" | "info" | "success" | "warning" | "danger" | "pending";
// dashboard-01 tablosundaki durum rozeti: outline Badge + durum simgesi.
export function StatusBadge({
  className,
  label,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { label: string; tone?: StatusTone }) {
  return (
    <Badge className={cn("px-1.5 text-muted-foreground", tone === "danger" && "text-destructive", className)} variant="outline" {...props}>
      {tone === "success" ? <IconCircleCheckFilled className="fill-green-500 dark:fill-green-400" /> : null}
      {tone === "pending" || tone === "warning" ? <IconLoader /> : null}
      {label}
    </Badge>
  );
}

// Sayfa govdesi: dashboard-01'deki "@container/main" sarmalayici ve bosluklari.
export function FirmPage({ children }: { children: ReactNode }) {
  return (
    <div className="@container/main flex flex-1 flex-col gap-2">
      <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">{children}</div>
    </div>
  );
}
