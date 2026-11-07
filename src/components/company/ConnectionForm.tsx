"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import CompanyPicker, { type PickedCompany } from "@/components/company/CompanyPicker";

interface Props {
  initialA: PickedCompany | null;
  initialB: PickedCompany | null;
}

export default function ConnectionForm({ initialA, initialB }: Props) {
  const router = useRouter();
  const [a, setA] = useState<PickedCompany | null>(initialA);
  const [b, setB] = useState<PickedCompany | null>(initialB);
  const ready = Boolean(a && b && a.nif !== b.nif);

  return (
    <form
      className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        if (!a || !b) return;
        const params = new URLSearchParams({ a: a.nif, an: a.name, b: b.nif, bn: b.name });
        router.push(`/connexions?${params.toString()}`);
      }}
    >
      <CompanyPicker label="Primera empresa" value={a} onChange={setA} />
      <CompanyPicker label="Segona empresa" value={b} onChange={setB} />
      <button
        type="submit"
        disabled={!ready}
        className="min-h-11 rounded-md bg-gray-900 px-5 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:bg-gray-300"
      >
        Cerca la connexió
      </button>
    </form>
  );
}
