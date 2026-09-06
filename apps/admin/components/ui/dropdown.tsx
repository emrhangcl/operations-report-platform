"use client";

import type { ButtonHTMLAttributes, HTMLAttributes, KeyboardEvent, ReactNode } from "react";
import { useEffect, useId, useRef, useState } from "react";
import { cn } from "./utils";

type DropdownProps = HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "end";
  label: ReactNode;
};

export function Dropdown({ align = "end", children, className, label, ...props }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, [open]);

  function getItems() {
    return Array.from(rootRef.current?.querySelectorAll<HTMLButtonElement>(".dropdown-item:not(:disabled)") ?? []);
  }

  function focusItem(index: number) {
    const items = getItems();
    items.at(index)?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;

    event.preventDefault();
    if (!open) {
      setOpen(true);
      window.requestAnimationFrame(() => focusItem(event.key === "ArrowDown" ? 0 : -1));
      return;
    }

    const items = getItems();
    const currentIndex = items.findIndex((item) => item === document.activeElement);
    const direction = event.key === "ArrowDown" ? 1 : -1;
    const nextIndex = currentIndex === -1
      ? (direction === 1 ? 0 : items.length - 1)
      : (currentIndex + direction + items.length) % items.length;
    items.at(nextIndex)?.focus();
  }

  return (
    <div className={cn("dropdown", className)} onKeyDown={handleKeyDown} ref={rootRef} {...props}>
      <button
        aria-controls={menuId}
        aria-expanded={open}
        aria-haspopup="menu"
        className="button secondary dropdown-trigger"
        onClick={() => setOpen((current) => !current)}
        ref={triggerRef}
        type="button"
      >
        {label}
      </button>
      {open ? (
        <div
          aria-orientation="vertical"
          className={cn("dropdown-menu", align === "start" && "align-start")}
          id={menuId}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest(".dropdown-item")) {
              setOpen(false);
            }
          }}
          role="menu"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type DropdownItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  inset?: boolean;
};

export function DropdownItem({ className, inset, type = "button", ...props }: DropdownItemProps) {
  return (
    <button
      className={cn("dropdown-item", inset && "inset", className)}
      role="menuitem"
      type={type}
      {...props}
    />
  );
}
