"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackEvent } from "@/lib/analytics";

const TABS = [
  {
    href: "/",
    label: "Inici",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-8.5Z" />
    ),
  },
  {
    href: "/empreses",
    label: "Empreses",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 10h5a1 1 0 0 1 1 1v10M8 8h2M8 12h2M8 16h2M3 21h18" />
    ),
  },
  {
    href: "/organismes",
    label: "Organismes",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21h18M5 21V10M19 21V10M9 21v-6h6v6M2 10l10-6 10 6M12 4v2" />
    ),
  },
  {
    href: "/contractes",
    label: "Contractes",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Zm7 0v5h5M9 13h6M9 17h6" />
    ),
  },
  {
    href: "/persones",
    label: "Persones",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2M9.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM21 21v-2a4 4 0 0 0-3-3.87M15 3.13a4 4 0 0 1 0 7.75" />
    ),
  },
];

/**
 * Persistent tab bar for phones. The header hamburger still holds the
 * secondary pages (Anàlisi, Sobre, Com licitar).
 */
export default function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      aria-label="Navegació principal"
    >
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const isActive =
            pathname === tab.href || (tab.href !== "/" && pathname.startsWith(`${tab.href}/`));
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                prefetch
                aria-current={isActive ? "page" : undefined}
                onClick={() => trackEvent("nav_tap", { tab: tab.label, from: pathname })}
                className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors ${
                  isActive ? "text-indigo-600" : "text-gray-500 active:text-gray-900"
                }`}
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  {tab.icon}
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
