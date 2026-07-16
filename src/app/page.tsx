"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { formatDate, formatEur, type Invoice } from "@/lib/types";

function InvoiceList() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);

  useEffect(() => {
    getSupabase()
      .from("invoices")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setInvoices((data as Invoice[]) ?? []));
  }, []);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Facturas</h1>
        <Link
          href="/facturas/nueva"
          className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          + Nueva factura
        </Link>
      </div>

      {invoices === null ? (
        <p className="text-slate-500">Cargando…</p>
      ) : invoices.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="mb-3 text-slate-500">Todavía no has emitido ninguna factura.</p>
          <Link href="/facturas/nueva" className="font-medium text-teal-700 hover:underline">
            Crea tu primera factura →
          </Link>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Número</th>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={inv.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/facturas/${inv.id}`} className="font-medium text-teal-700 hover:underline">
                      {inv.number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatDate(inv.issue_date)}</td>
                  <td className="px-4 py-3">{inv.client.name}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatEur(inv.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AppShell>
      <InvoiceList />
    </AppShell>
  );
}
