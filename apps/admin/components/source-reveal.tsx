"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

type SourceRevealProps = { children: ReactNode; className?: string; delay?: number; as?: "div" | "section" | "li" };

export function SourceReveal({ children, className = "", delay = 0, as = "div" }: SourceRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      }
    }, { threshold: 0.15, rootMargin: "0px 0px -60px 0px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const Tag = as as "div";
  return <Tag ref={ref as React.RefObject<HTMLDivElement>} className={`${shown ? "source-reveal-in" : "source-reveal"} ${className}`} style={shown && delay ? { animationDelay: `${delay}ms` } : undefined}>{children}</Tag>;
}
