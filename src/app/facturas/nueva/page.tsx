"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AppShell, { useProfile } from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { isValidTaxId, normalizeNif } from "@/lib/nif";
import {
  computeTotals,
  formatEur,
  VAT_EXEMPT_NOTE,
  type Client,
  type InvoiceLine,
  type Template,
} from "@/lib/types";

const input =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none";

function todayIso(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function NewInvoiceForm() {
  const router = useRouter();
  const { profile } = useProfile();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  const [clientId, setClientId] = useState<string>("");
  const [newClient, setNewClient] = useState({ name: "", nif: "", address: "", city: "", postal_code: "" });
  const [creatingClient, setCreatingClient] = useState(false);

  const [issueDate, setIssueDate] = useState(todayIso());
  const [lines, setLines] = useState<InvoiceLine[]>([{ concept: "", qty: 1, price: 0 }]);
  const [vatExempt, setVatExempt] = useState(true);
  const [applyIrpf, setApplyIrpf] = useState(false);
  const [irpfRate, setIrpfRate] = useState(profile.irpf_rate);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabase();
    supabase
      .from("templates")
      .select("*")
      .order("created_at")
      .then(({ data }) => setTemplates((data as Template[]) ?? []));
    supabase
      .from("clients")
      .select("*")
      .order("name")
      .then(({ data }) => {
        const list = (data as Client[]) ?? [];
        setClients(list);
        setCreatingClient(list.length === 0);
      });
  }, []);

  function applyTemplate(t: Template) {
    setSelectedTemplate(t.id);
    setLines([{ concept: t.concept, qty: 1, price: Number(t.unit_price) }]);
    setApplyIrpf(t.irpf_applies);
  }

  function setLine(i: number, patch: Partial<InvoiceLine>) {
    setLines((ls) => ls.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  const totals = computeTotals(lines, vatExempt, 21, applyIrpf ? irpfRate : 0);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const validLines = lines.filter((l) => l.concept.trim());
    if (validLines.length === 0) {
      setError("Añade al menos un concepto a la factura.");
      return;
    }

    const supabase = getSupabase();
    let clientSnapshot: Omit<Client, "id">;
    let usedClientId: string | null = null;

    if (creatingClient) {
      const nif = normalizeNif(newClient.nif);
      if (!newClient.name.trim()) {
        setError("Indica el nombre del cliente.");
        return;
      }
      if (!isValidTaxId(nif)) {
        setError("El NIF/CIF del cliente no es válido. Es obligatorio para emitir la factura.");
        return;
      }
      setBusy(true);
      const { data, error: insertError } = await supabase
        .from("clients")
        .insert({
          user_id: profile.user_id,
          name: newClient.name.trim(),
          nif,
          address: newClient.address.trim(),
          city: newClient.city.trim(),
          postal_code: newClient.postal_code.trim(),
        })
        .select()
        .single();
      if (insertError || !data) {
        setBusy(false);
        setError("No se pudo guardar el cliente: " + insertError?.message);
        return;
      }
      usedClientId = data.id;
      clientSnapshot = {
        name: data.name,
        nif: data.nif,
        address: data.address,
        city: data.city,
        postal_code: data.postal_code,
      };
    } else {
      const client = clients.find((c) => c.id === clientId);
      if (!client) {
        setError("Selecciona un cliente o crea uno nuevo.");
        return;
      }
      setBusy(true);
      usedClientId = client.id;
      clientSnapshot = {
        name: client.name,
        nif: client.nif,
        address: client.address,
        city: client.city,
        postal_code: client.postal_code,
      };
    }

    const { data: number, error: numberError } = await supabase.rpc("allocate_invoice_number");
    if (numberError || !number) {
      setBusy(false);
      setError("No se pudo asignar el número de factura: " + numberError?.message);
      return;
    }

    const irpf = applyIrpf ? irpfRate : 0;
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        user_id: profile.user_id,
        number,
        issue_date: issueDate,
        issuer: {
          full_name: profile.full_name,
          nif: profile.nif,
          address: profile.address,
          city: profile.city,
          postal_code: profile.postal_code,
          province: profile.province,
        },
        client_id: usedClientId,
        client: clientSnapshot,
        lines: validLines,
        subtotal: totals.subtotal,
        vat_exempt: vatExempt,
        vat_rate: vatExempt ? 0 : 21,
        vat_amount: totals.vatAmount,
        irpf_rate: irpf,
        irpf_amount: totals.irpfAmount,
        total: totals.total,
      })
      .select("id")
      .single();

    setBusy(false);
    if (invoiceError || !invoice) {
      setError("No se pudo guardar la factura: " + invoiceError?.message);
      return;
    }
    router.push(`/facturas/${invoice.id}`);
  }

  return (
    <form onSubmit={save} className="space-y-6">
      <h1 className="text-xl font-semibold">Nueva factura</h1>

      {templates.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-slate-600">Empieza desde una plantilla</h2>
          <div className="flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className={`rounded-lg border px-4 py-3 text-left text-sm shadow-sm transition ${
                  selectedTemplate === t.id
                    ? "border-teal-600 bg-teal-50"
                    : "border-slate-200 bg-white hover:border-teal-400"
                }`}
              >
                <span className="block font-semibold">{t.name}</span>
                <span className="block text-slate-500">{formatEur(Number(t.unit_price))}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-medium">Cliente</h2>
        {!creatingClient ? (
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={input + " max-w-xs"}
            >
              <option value="">— Selecciona un cliente —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.nif})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setCreatingClient(true)}
              className="text-sm font-medium text-teal-700 hover:underline"
            >
              + Nuevo cliente
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                placeholder="Nombre o razón social *"
                value={newClient.name}
                onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                className={input}
              />
              <input
                placeholder="NIF / CIF * (p. ej. 12345678Z o B12345678)"
                value={newClient.nif}
                onChange={(e) => setNewClient({ ...newClient, nif: e.target.value })}
                className={input}
              />
              <input
                placeholder="Dirección"
                value={newClient.address}
                onChange={(e) => setNewClient({ ...newClient, address: e.target.value })}
                className={input}
              />
              <div className="grid grid-cols-2 gap-3">
                <input
                  placeholder="Población"
                  value={newClient.city}
                  onChange={(e) => setNewClient({ ...newClient, city: e.target.value })}
                  className={input}
                />
                <input
                  placeholder="C.P."
                  value={newClient.postal_code}
                  onChange={(e) => setNewClient({ ...newClient, postal_code: e.target.value })}
                  className={input}
                />
              </div>
            </div>
            {clients.length > 0 && (
              <button
                type="button"
                onClick={() => setCreatingClient(false)}
                className="text-sm text-slate-500 hover:text-teal-700"
              >
                ← Elegir un cliente existente
              </button>
            )}
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-medium">Conceptos</h2>
          <label className="text-sm text-slate-600">
            Fecha:{" "}
            <input
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1"
            />
          </label>
        </div>
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="flex gap-2">
              <input
                placeholder="Descripción del servicio"
                value={line.concept}
                onChange={(e) => setLine(i, { concept: e.target.value })}
                className={input + " flex-1"}
              />
              <input
                type="number"
                min="1"
                value={line.qty}
                onChange={(e) => setLine(i, { qty: Number(e.target.value) })}
                className={input + " w-20"}
                title="Cantidad"
              />
              <input
                type="number"
                min="0"
                step="0.01"
                value={line.price}
                onChange={(e) => setLine(i, { price: Number(e.target.value) })}
                className={input + " w-28"}
                title="Precio (€)"
              />
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => setLines((ls) => ls.filter((_, idx) => idx !== i))}
                  className="px-2 text-slate-400 hover:text-red-600"
                  title="Eliminar línea"
                >
                  ✕
                </button>
              )}
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setLines((ls) => [...ls, { concept: "", qty: 1, price: 0 }])}
          className="mt-3 text-sm font-medium text-teal-700 hover:underline"
        >
          + Añadir línea
        </button>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-3 font-medium">Impuestos</h2>
        <label className="flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={vatExempt}
            onChange={(e) => setVatExempt(e.target.checked)}
            className="mt-0.5"
          />
          <span>
            Exenta de IVA (asistencia sanitaria)
            <span className="block text-xs text-slate-400">
              {vatExempt ? VAT_EXEMPT_NOTE : "Se aplicará IVA del 21%."}
            </span>
          </span>
        </label>
        <label className="mt-3 flex items-start gap-2 text-sm">
          <input
            type="checkbox"
            checked={applyIrpf}
            onChange={(e) => setApplyIrpf(e.target.checked)}
            className="mt-0.5"
          />
          <span className="flex items-center gap-2">
            Retención IRPF
            {applyIrpf && (
              <input
                type="number"
                min="0"
                max="47"
                step="0.5"
                value={irpfRate}
                onChange={(e) => setIrpfRate(Number(e.target.value))}
                className="w-20 rounded border border-slate-300 px-2 py-1"
              />
            )}
            {applyIrpf && <span>%</span>}
            <span className="text-xs text-slate-400">(al facturar a clínicas o empresas)</span>
          </span>
        </label>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-slate-500">Base imponible</span>
            <span>{formatEur(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">{vatExempt ? "IVA (exento)" : "IVA (21%)"}</span>
            <span>{formatEur(totals.vatAmount)}</span>
          </div>
          {applyIrpf && (
            <div className="flex justify-between">
              <span className="text-slate-500">Retención IRPF ({irpfRate}%)</span>
              <span>−{formatEur(totals.irpfAmount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-slate-200 pt-1 text-base font-semibold">
            <span>Total</span>
            <span>{formatEur(totals.total)}</span>
          </div>
        </div>
      </section>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-teal-600 px-6 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Emitir factura"}
        </button>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="rounded border border-slate-300 px-6 py-2 text-slate-600 hover:bg-slate-100"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

export default function NewInvoicePage() {
  return (
    <AppShell>
      <NewInvoiceForm />
    </AppShell>
  );
}
