"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getSupabase } from "@/lib/supabase";
import { isValidTaxId, normalizeNif } from "@/lib/nif";

const DEFAULT_TEMPLATES = [
  { name: "1ª visita", concept: "Primera visita — consulta médica", unit_price: 80, irpf_applies: false },
  { name: "2ª visita", concept: "Visita de seguimiento — consulta médica", unit_price: 60, irpf_applies: false },
  { name: "Visita clínica", concept: "Servicios médicos prestados en clínica", unit_price: 100, irpf_applies: true },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isNew, setIsNew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    nif: "",
    address: "",
    city: "",
    postal_code: "",
    province: "",
    irpf_rate: "15",
    invoice_prefix: "F",
  });

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) {
        router.replace("/login");
        return;
      }
      setUserId(session.user.id);
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (data) {
        setIsNew(false);
        setForm({
          full_name: data.full_name,
          nif: data.nif,
          address: data.address,
          city: data.city,
          postal_code: data.postal_code,
          province: data.province,
          irpf_rate: String(data.irpf_rate),
          invoice_prefix: data.invoice_prefix,
        });
      }
    });
  }, [router]);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    const nif = normalizeNif(form.nif);
    if (!isValidTaxId(nif)) {
      setError("El NIF/DNI introducido no es válido. Revisa el número y la letra.");
      return;
    }
    setBusy(true);
    setError(null);
    const supabase = getSupabase();
    const { error } = await supabase.from("profiles").upsert({
      user_id: userId,
      full_name: form.full_name.trim(),
      nif,
      address: form.address.trim(),
      city: form.city.trim(),
      postal_code: form.postal_code.trim(),
      province: form.province.trim(),
      irpf_rate: Number(form.irpf_rate) || 0,
      invoice_prefix: form.invoice_prefix.trim() || "F",
    });
    if (error) {
      setBusy(false);
      setError("No se pudo guardar el perfil: " + error.message);
      return;
    }
    if (isNew) {
      const { count } = await supabase
        .from("templates")
        .select("id", { count: "exact", head: true });
      if (!count) {
        await supabase
          .from("templates")
          .insert(DEFAULT_TEMPLATES.map((t) => ({ ...t, user_id: userId })));
      }
    }
    router.replace("/");
  }

  const input =
    "w-full rounded border border-slate-300 px-3 py-2 focus:border-teal-500 focus:outline-none";

  return (
    <div className="mx-auto max-w-xl px-4 py-10">
      <h1 className="mb-1 text-xl font-semibold text-teal-700">
        {isNew ? "Completa tus datos de facturación" : "Tus datos de facturación"}
      </h1>
      <p className="mb-6 text-sm text-slate-500">
        Estos datos aparecerán como emisor en tus facturas. El DNI/NIF es obligatorio.
      </p>
      <form onSubmit={save} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Nombre completo *</span>
          <input required value={form.full_name} onChange={set("full_name")} className={input} placeholder="Dra. María García López" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">DNI / NIF *</span>
          <input required value={form.nif} onChange={set("nif")} className={input} placeholder="12345678Z" />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Dirección *</span>
          <input required value={form.address} onChange={set("address")} className={input} placeholder="C/ Mayor 1, 2º A" />
        </label>
        <div className="grid grid-cols-3 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Población *</span>
            <input required value={form.city} onChange={set("city")} className={input} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">C.P. *</span>
            <input required value={form.postal_code} onChange={set("postal_code")} className={input} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Provincia *</span>
            <input required value={form.province} onChange={set("province")} className={input} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">% IRPF por defecto</span>
            <input type="number" min="0" max="47" step="0.5" value={form.irpf_rate} onChange={set("irpf_rate")} className={input} />
            <span className="mt-1 block text-xs text-slate-400">
              Retención aplicada al facturar a clínicas o empresas (habitual: 15%).
            </span>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Prefijo de factura</span>
            <input value={form.invoice_prefix} onChange={set("invoice_prefix")} className={input} placeholder="F" />
            <span className="mt-1 block text-xs text-slate-400">
              Las facturas se numerarán {form.invoice_prefix || "F"}-0001, {form.invoice_prefix || "F"}-0002…
            </span>
          </label>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded bg-teal-600 px-4 py-2 font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar y continuar"}
        </button>
      </form>
    </div>
  );
}
