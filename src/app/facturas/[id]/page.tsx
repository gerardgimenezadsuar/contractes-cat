"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { formatDate, formatEur, VAT_EXEMPT_NOTE, type Invoice } from "@/lib/types";

const DownloadPdfButton = dynamic(() => import("@/components/InvoicePDF"), {
  ssr: false,
  loading: () => (
    <button className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white opacity-50">
      ⬇ Descargar PDF
    </button>
  ),
});

function InvoiceDetail() {
  const { id } = useParams<{ id: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    getSupabase()
      .from("invoices")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setInvoice(data as Invoice);
        else setNotFound(true);
      });
  }, [id]);

  if (notFound) {
    return (
      <p className="text-slate-500">
        Factura no encontrada.{" "}
        <Link href="/" className="text-teal-700 hover:underline">Volver</Link>
      </p>
    );
  }
  if (!invoice) return <p className="text-slate-500">Cargando…</p>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-slate-500 hover:text-teal-700">
            ← Facturas
          </Link>
          <h1 className="text-xl font-semibold">Factura {invoice.number}</h1>
        </div>
        <DownloadPdfButton invoice={invoice} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 flex items-start justify-between">
          <span className="text-2xl font-bold text-teal-700">FACTURA</span>
          <div className="text-right text-sm">
            <p className="font-semibold">{invoice.number}</p>
            <p className="text-slate-500">{formatDate(invoice.issue_date)}</p>
          </div>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2">
          <div className="rounded border border-slate-200 p-4 text-sm">
            <p className="mb-1 text-xs font-medium uppercase text-slate-400">Emisor</p>
            <p className="font-semibold">{invoice.issuer.full_name}</p>
            <p>NIF: {invoice.issuer.nif}</p>
            <p>{invoice.issuer.address}</p>
            <p>
              {invoice.issuer.postal_code} {invoice.issuer.city}
              {invoice.issuer.province ? ` (${invoice.issuer.province})` : ""}
            </p>
          </div>
          <div className="rounded border border-slate-200 p-4 text-sm">
            <p className="mb-1 text-xs font-medium uppercase text-slate-400">Cliente</p>
            <p className="font-semibold">{invoice.client.name}</p>
            <p>NIF/CIF: {invoice.client.nif}</p>
            {invoice.client.address && <p>{invoice.client.address}</p>}
            {(invoice.client.postal_code || invoice.client.city) && (
              <p>
                {invoice.client.postal_code} {invoice.client.city}
              </p>
            )}
          </div>
        </div>

        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b-2 border-teal-700 text-left">
              <th className="py-2 font-semibold">Concepto</th>
              <th className="py-2 text-right font-semibold">Cant.</th>
              <th className="py-2 text-right font-semibold">Precio</th>
              <th className="py-2 text-right font-semibold">Importe</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((line, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-2">{line.concept}</td>
                <td className="py-2 text-right">{line.qty}</td>
                <td className="py-2 text-right">{formatEur(line.price)}</td>
                <td className="py-2 text-right">{formatEur(line.qty * line.price)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Base imponible</span>
            <span>{formatEur(invoice.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">
              {invoice.vat_exempt ? "IVA (exento)" : `IVA (${invoice.vat_rate}%)`}
            </span>
            <span>{formatEur(invoice.vat_amount)}</span>
          </div>
          {invoice.irpf_rate > 0 && (
            <div className="flex justify-between">
              <span className="text-slate-500">Retención IRPF ({invoice.irpf_rate}%)</span>
              <span>−{formatEur(invoice.irpf_amount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-300 pt-2 text-base font-bold">
            <span>Total</span>
            <span>{formatEur(invoice.total)}</span>
          </div>
        </div>

        {invoice.vat_exempt && (
          <p className="mt-8 text-xs text-slate-400">{VAT_EXEMPT_NOTE}</p>
        )}
      </div>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <AppShell>
      <InvoiceDetail />
    </AppShell>
  );
}
