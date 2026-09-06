import type { HTMLAttributes, ReactNode, TableHTMLAttributes, TdHTMLAttributes, ThHTMLAttributes } from "react";
import { cn } from "./utils";

export function DataTablePanel({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("table-panel data-table-panel", className)} {...props}>
      {children}
    </div>
  );
}

export function DataTable({ children, className, ...props }: TableHTMLAttributes<HTMLTableElement>) {
  return (
    <table className={cn("data-table", className)} {...props}>
      {children}
    </table>
  );
}

export function DataTableHeader({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <thead className={className} {...props}>
      {children}
    </thead>
  );
}

export function DataTableBody({ children, className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tbody className={className} {...props}>
      {children}
    </tbody>
  );
}

export function DataTableRow({ children, className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr className={className} {...props}>
      {children}
    </tr>
  );
}

export function DataTableHead({ children, className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th className={className} {...props}>
      {children}
    </th>
  );
}

export function DataTableCell({
  children,
  className,
  ...props
}: TdHTMLAttributes<HTMLTableCellElement> & { children?: ReactNode }) {
  return (
    <td className={className} {...props}>
      {children}
    </td>
  );
}
