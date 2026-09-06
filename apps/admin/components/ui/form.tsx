import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  type HTMLAttributes,
  type ReactElement,
  type ReactNode
} from "react";
import { cn } from "./utils";

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  htmlFor?: string;
  label: ReactNode;
};

export function FormField({ children, className, error, hint, htmlFor, label, ...props }: FormFieldProps) {
  const generatedId = useId().replace(/:/g, "");
  const childList = Children.toArray(children);
  const directControl = childList.length === 1 && isValidElement(childList[0]) &&
    typeof childList[0].type === "string" &&
    ["input", "select", "textarea"].includes(childList[0].type);
  const directControlElement = directControl
    ? childList[0] as ReactElement<{ id?: string }>
    : null;
  const generatedControlId = `field-${generatedId}`;
  const resolvedHtmlFor = htmlFor ?? directControlElement?.props.id ?? (directControlElement ? generatedControlId : undefined);
  const resolvedChildren = directControlElement && !directControlElement.props.id
    ? cloneElement(directControlElement, { id: resolvedHtmlFor ?? generatedControlId })
    : children;
  const labelId = `field-label-${generatedId}`;

  return (
    <div
      aria-labelledby={resolvedHtmlFor ? undefined : labelId}
      className={cn("field", className)}
      role={resolvedHtmlFor ? undefined : "group"}
      {...props}
    >
      <label htmlFor={resolvedHtmlFor} id={labelId}>{label}</label>
      {resolvedChildren}
      {error ? <small className="form-field-error" role="alert">{error}</small> : null}
      {!error && hint ? <small className="form-field-hint">{hint}</small> : null}
    </div>
  );
}

type FormSectionProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  title?: ReactNode;
};

export function FormSection({ children, className, title, ...props }: FormSectionProps) {
  return (
    <section className={cn("form-section", className)} {...props}>
      {title ? <h2>{title}</h2> : null}
      {children}
    </section>
  );
}

export function FormActions({ children, className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("actions", className)} {...props}>
      {children}
    </div>
  );
}
