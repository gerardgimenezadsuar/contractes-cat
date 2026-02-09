"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE_NAME } from "@/config/constants";

const NAV_ITEMS = [
  { href: "/", label: "Inici" },
  { href: "/empreses", label: "Empreses" },
  { href: "/organismes", label: "Organismes" },
  { href: "/contractes", label: "Contractes" },
  { href: "/analisi", label: "Anàlisi" },
  { href: "/about", label: "Sobre" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" prefetch className="flex items-center gap-2">
            <span className="text-xl font-bold text-gray-900">
              {SITE_NAME}
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center h-full gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  className={`relative px-4 py-2 text-sm transition-colors ${
                    isActive
                      ? "text-indigo-600 font-semibold"
                      : "text-gray-500 font-medium hover:text-gray-900"
                  }`}
                >
                  {item.label}
                  <span
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 h-[3px] rounded-full bg-indigo-500 transition-all duration-200 ${
                      isActive ? "w-5/6" : "w-0 group-hover:w-1/2"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-md text-gray-600 hover:bg-gray-50"
            aria-label="Obre menú"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden pb-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch
                  onClick={() => setMobileOpen(false)}
                  className={`block px-3 py-2 rounded-md text-sm ${
                    isActive
                      ? "text-indigo-600 font-semibold bg-indigo-50 border-l-[3px] border-indigo-500"
                      : "text-gray-500 font-medium hover:text-gray-900 hover:bg-gray-50"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}
      </div>
    </header>
  );
}
