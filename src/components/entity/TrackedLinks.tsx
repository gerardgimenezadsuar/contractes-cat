"use client";

import { useEffect, useRef, type MouseEvent, type ReactNode, type RefObject } from "react";
import { trackEvent } from "@/lib/analytics";

type Tag = "section" | "div";

interface Props {
  /** Page and section the clicks come from, e.g. "empresa/resum". */
  from: string;
  as?: Tag;
  id?: string;
  className?: string;
  /** Also report `section_view` (same `from`) once, when the block first scrolls into view. */
  trackView?: boolean;
  children: ReactNode;
}

/** What kind of page a link leads to, from its href. */
export function linkTarget(href: string): string | null {
  if (!href || href.startsWith("#")) return null;
  if (/^https?:\/\/(www\.)?chatgpt\.com\//i.test(href)) return "chatgpt";
  if (/^https?:\/\/claude\.ai\//i.test(href)) return "claude";
  if (/^https?:\/\//i.test(href) && !href.includes("contractes.cat")) return "external";
  const path = href.replace(/^https?:\/\/[^/]+/i, "");
  if (path.startsWith("/empreses/")) return "empresa";
  if (path.startsWith("/organismes/")) return "organisme";
  if (path.startsWith("/persones/")) return "persona";
  if (path.startsWith("/grups/")) return "grup";
  if (path.startsWith("/contractes")) return "contractes";
  return "other";
}

/**
 * Wraps a server-rendered block and reports which links people follow from it
 * (one delegated listener, so the children stay server components). Vercel
 * Analytics allows two properties per event: `from` = page/section, `to` =
 * kind of page the link leads to.
 */
export default function TrackedLinks({ from, as = "div", id, className, trackView = false, children }: Props) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!trackView || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        trackEvent("section_view", { from });
        observer.disconnect();
      },
      // Counts as seen once its top edge is well inside the viewport, not when it peeks in.
      { rootMargin: "0px 0px -25% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [from, trackView]);

  const onClick = (event: MouseEvent<HTMLElement>) => {
    // Nested blocks: the innermost one reports the click, outer ones skip it.
    const native = event.nativeEvent as Event & { trackedLink?: boolean };
    if (native.trackedLink) return;
    const anchor = (event.target as HTMLElement).closest("a");
    if (!anchor) return;
    const to = linkTarget(anchor.getAttribute("href") || "");
    if (!to) return;
    native.trackedLink = true;
    trackEvent("entity_link", { from, to });
  };
  const Tag = as;
  return (
    // Both tags are HTMLElement; the cast keeps the ref type independent of `as`.
    <Tag ref={ref as RefObject<HTMLDivElement>} id={id} className={className} onClick={onClick}>
      {children}
    </Tag>
  );
}
