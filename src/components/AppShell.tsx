"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { getSupabase } from "@/lib/supabase";
import type { Profile } from "@/lib/types";

interface ShellContextValue {
  profile: Profile;
  refreshProfile: () => Promise<void>;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useProfile(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error("useProfile debe usarse dentro de AppShell");
  return ctx;
}

const NAV = [
  { href: "/", label: "Facturas" },
  { href: "/clientes", label: "Clientes" },
  { href: "/plantillas", label: "Plantillas" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(() => {
    const supabase = getSupabase();
    return supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (!session) {
          router.replace("/login");
          return null;
        }
        return supabase
          .from("profiles")
          .select("*")
          .eq("user_id", session.user.id)
          .maybeSingle();
      })
      .then((result) => {
        if (!result) return;
        if (!result.data) {
          router.replace("/onboarding");
          return;
        }
        setProfile(result.data as Profile);
        setLoading(false);
      });
  }, [router]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  async function signOut() {
    await getSupabase().auth.signOut();
    router.replace("/login");
  }

  if (loading || !profile) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-500">
        Cargando…
      </div>
    );
  }

  return (
    <ShellContext.Provider value={{ profile, refreshProfile: loadProfile }}>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-6">
            <Link href="/" className="text-lg font-semibold text-teal-700">
              Facturas Médicas
            </Link>
            <nav className="flex gap-4 text-sm">
              {NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={
                    pathname === item.href
                      ? "font-semibold text-teal-700"
                      : "text-slate-600 hover:text-teal-700"
                  }
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <Link href="/onboarding" className="text-slate-500 hover:text-teal-700">
              {profile.full_name}
            </Link>
            <button
              onClick={signOut}
              className="rounded border border-slate-300 px-2 py-1 text-slate-600 hover:bg-slate-100"
            >
              Salir
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </ShellContext.Provider>
  );
}
