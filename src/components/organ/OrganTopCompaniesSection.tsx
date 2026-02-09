"use client";

import { useEffect, useState } from "react";
import type { CompanyAggregation } from "@/lib/types";
import OrganTopCompaniesTable from "@/components/organ/OrganTopCompaniesTable";

interface Props {
  organName: string;
  organTotalAmount: number;
}

export default function OrganTopCompaniesSection({ organName, organTotalAmount }: Props) {
  const [rows, setRows] = useState<CompanyAggregation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();

    async function run() {
      try {
        const params = new URLSearchParams({ organ: organName, limit: "10" });
        const res = await fetch(`/api/organismes/top-empreses?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`Failed to fetch (${res.status})`);
        const json = await res.json();
        setRows(json.data || []);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("Error fetching organisme top companies:", err);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    run();
    return () => controller.abort();
  }, [organName]);

  if (loading) {
    return (
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Empreses adjudicatàries principals</h2>
        <div className="rounded-lg border border-gray-100 bg-white p-4 text-sm text-gray-500">
          Carregant empreses...
        </div>
      </section>
    );
  }

  if (rows.length === 0) return null;

  return <OrganTopCompaniesTable rows={rows} organTotalAmount={organTotalAmount} />;
}
