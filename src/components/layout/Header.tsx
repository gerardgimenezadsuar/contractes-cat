"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { SITE_NAME } from "@/config/constants";
import { useTheme } from "@/components/theme/ThemeProvider";

const NAV_ITEMS = [
  { href: "/", label: "Inici" },
  { href: "/empreses", label: "Empreses" },
  { href: "/persones", label: "Persones" },
  { href: "/organismes", label: "Organismes" },
  { href: "/contractes", label: "Contractes" },
  { href: "/analisi", label: "Anàlisi" },
  { href: "/about", label: "Sobre" },
];

export default function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" prefetch className="flex items-center shrink-0">
            <span className="block">
              <Image
                src={theme === "dark" ? "/logo-landing-dark.svg" : "/logo-landing-light.svg"}
                alt={SITE_NAME}
                width={320}
                height={80}
                priority
                className="h-14 w-auto max-w-[200px] md:h-16 md:max-w-[240px]"
              />
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

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
        className="ml-3 inline-flex items-center justify-center rounded-full px-2.5 py-1.5 text-xs font-medium shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 theme-toggle"
            aria-label={theme === "dark" ? "Canvia a mode clar" : "Canvia a mode fosc"}
          >
            <span className="mr-1.5">
              {theme === "dark" ? (
                // Sun icon
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <circle cx="12" cy="12" r="4" strokeWidth="1.8" />
                  <path
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    d="M12 3v2.5M12 18.5V21M4.22 4.22 5.99 5.99M18.01 18.01l1.77 1.77M3 12h2.5M18.5 12H21M4.22 19.78 5.99 18.01M18.01 5.99l1.77-1.77"
                  />
                </svg>
              ) : (
                // Moon icon
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path
                    d="M20 14.5A7.5 7.5 0 0 1 11.5 6 6 6 0 1 0 20 14.5Z"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span>{theme === "dark" ? "Clar" : "Fosc"}</span>
          </button>

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
