"use client";

import { useEffect, useState } from "react";

export interface SectionTab {
  id: string;
  label: string;
}

interface Props {
  tabs: SectionTab[];
}

/**
 * In-page navigation for the sections of an entity page. Plain anchors keep
 * every section server-rendered and linkable; the active tab follows the
 * section currently in view.
 */
export default function SectionTabs({ tabs }: Props) {
  const [active, setActive] = useState(tabs[0]?.id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // The band below the sticky header decides which section is "current".
      { rootMargin: "-120px 0px -70% 0px" }
    );
    for (const tab of tabs) {
      const el = document.getElementById(tab.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [tabs]);

  return (
    <nav
      aria-label="Seccions de la pàgina"
      className="sticky top-16 z-30 -mx-4 overflow-x-auto border-b border-gray-200 bg-white/95 px-4 backdrop-blur"
    >
      <ul className="flex gap-1">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <li key={tab.id}>
              <a
                href={`#${tab.id}`}
                aria-current={isActive ? "location" : undefined}
                onClick={() => setActive(tab.id)}
                className={`-mb-px inline-block whitespace-nowrap border-b-2 px-3 py-3 text-sm font-medium ${
                  isActive ? "border-accent text-gray-900" : "border-transparent text-gray-500 hover:text-gray-900"
                }`}
              >
                {tab.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
