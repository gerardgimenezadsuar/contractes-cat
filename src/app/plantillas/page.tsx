"use client";

import { useEffect, useState } from "react";
import AppShell, { useProfile } from "@/components/AppShell";
import { getSupabase } from "@/lib/supabase";
import { formatEur, type Template } from "@/lib/types";

const input =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none";

const EMPTY = { name: "", concept: "", unit_price: "", irpf_applies: false };

function TemplatesManager() {
  const { profile } = useProfile();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() {
    getSupabase()
      .from("templates")
      .select("*")
      .order("created_at")
      .then(({ data }) => setTemplates((data as Template[]) ?? []));
  }

  useEffect(load, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error } = await getSupabase().from("templates").insert({
      user_id: profile.user_id,
      name: form.name.trim(),
      concept: form.concept.trim(),
      unit_price: Number(form.unit_price) || 0,
      irpf_applies: form.irpf_applies,
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
    if (!confirm("¿Eliminar esta plantilla?")) return;
    await getSupabase().from("templates").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Plantillas</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          {showForm ? "Cerrar" : "+ Nueva plantilla"}
        </button>
      </div>
      <p className="mb-6 text-sm text-slate-500">
        Las plantillas te permiten emitir facturas habituales (1ª visita, seguimiento…) en un clic.
      </p>

      {showForm && (
        <form onSubmit={save} className="mb-6 space-y-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-3 sm:grid-cols-2">
            <input required placeholder="Nombre (p. ej. 1ª visita) *" value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })} className={input} />
            <input required type="number" min="0" step="0.01" placeholder="Precio (€) *" value={form.unit_price}
              onChange={(e) => setForm({ ...form, unit_price: e.target.value })} className={input} />
          </div>
          <input required placeholder="Concepto que aparecerá en la factura *" value={form.concept}
            onChange={(e) => setForm({ ...form, concept: e.target.value })} className={input} />
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.irpf_applies}
              onChange={(e) => setForm({ ...form, irpf_applies: e.target.checked })} />
            Aplicar retención IRPF por defecto (facturas a clínicas/empresas)
          </label>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={busy}
            className="rounded bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50">
            {busy ? "Guardando…" : "Guardar plantilla"}
          </button>
        </form>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {templates.map((t) => (
          <div key={t.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div>
              <p className="font-semibold">{t.name}</p>
              <p className="text-sm text-slate-500">{t.concept}</p>
              <p className="mt-1 text-sm font-medium text-teal-700">
                {formatEur(Number(t.unit_price))}
                {t.irpf_applies && <span className="ml-2 text-xs text-slate-400">con IRPF</span>}
              </p>
            </div>
            <button onClick={() => remove(t.id)} className="text-slate-400 hover:text-red-600" title="Eliminar">
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function TemplatesPage() {
  return (
    <AppShell>
      <TemplatesManager />
    </AppShell>
  );
}
