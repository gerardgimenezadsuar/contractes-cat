import type { Metadata } from "next";
import { fetchCompanies, fetchCompaniesCount } from "@/lib/api";
import CompaniesTable from "@/components/tables/CompaniesTable";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import SharePageButton from "@/components/ui/SharePageButton";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Empreses adjudicatàries",
  description:
    "Rànquing d'empreses per import total de contractes públics adjudicats a Catalunya.",
};

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function EmpresePage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;

  const [companies, total] = await Promise.all([
    fetchCompanies(offset, DEFAULT_PAGE_SIZE, search || undefined),
    fetchCompaniesCount(search || undefined),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">
          Empreses adjudicatàries
        </h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-8">
        Rànquing d&apos;empreses per import total de contractes públics
        adjudicats. Fes clic en una empresa per veure el detall.
      </p>

      <CompaniesTable
        initialData={companies}
        initialTotal={total}
        initialSearch={search}
        initialPage={page}
      />
    </div>
  );
}
