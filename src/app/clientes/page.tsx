"use client";

import { useEffect, useState } from "react";
import AppShell, { useProfile } from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { isValidTaxId, normalizeNif } from "@/lib/nif";
import type { Client } from "@/lib/types";

const input =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none";

const EMPTY = { name: "", nif: "", address: "", city: "", postal_code: "" };

function ClientsManager() {
  const { profile } = useProfile();
  const [clients, setClients] = useState<Client[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    getSupabase()
      .from("clients")
      .select("*")
      .order("name")
      .then(({ data }) => setClients((data as Client[]) ?? []));
  }

  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const nif = normalizeNif(form.nif);
    if (!isValidTaxId(nif)) {
      setError("El NIF/CIF no es válido.");
      return;
    }
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().from("clients").insert({
      user_id: profile.user_id,
      name: form.name.trim(),
      nif,
      address: form.address.trim(),
      city: form.city.trim(),
      postal_code: form.postal_code.trim(),
    });
    setBusy(false);
    if (error) {
      setError("No se pudo guardar: " + error.message);
      return;
    }
    setForm(EMPTY);
    setShowForm(false);
    load();
  }

  async function remove(id: string) {
    if (!confirm("¿Eliminar este cliente? Sus facturas emitidas no se verán afectadas.")) return;
    await getSupabase().from("clients").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Clientes</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          {showForm ? "Cerrar" : "+ Nuevo cliente"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={save} className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Nombre o razón social *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <input required placeholder="NIF / CIF *" value={form.nif}
              onChange={(e) => setForm({ ...form, nif: e.target.value })} className={input} />
            <input placeholder="Dirección" value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })} className={input} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Población" value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })} className={input} />
              <input placeholder="C.P." value={form.postal_code}
                onChange={(e) => setForm({ ...form, postal_code: e.target.value })} className={input} />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {busy ? "Guardando…" : "Guardar cliente"}
          </button>
        </form>
      )}

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          Aún no tienes clientes. Añade pacientes o clínicas a los que facturas.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">NIF/CIF</th>
                <th className="px-4 py-3 font-medium">Dirección</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td className="px-4 py-3">{c.nif}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {[c.address, c.postal_code, c.city].filter(Boolean).join(", ")}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => remove(c.id)} className="text-slate-400 hover:text-red-600" title="Eliminar">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function ClientsPage() {
  return (
    <AppShell>
      <ClientsManager />
    </AppShell>
  );
}
