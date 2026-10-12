import type { Metadata } from "next";
import { fetchCompanies, fetchCompaniesCount } from "@/lib/api";
import CompaniesTable from "@/components/tables/CompaniesTable";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import SharePageButton from "@/components/ui/SharePageButton";

export const metadata: Metadata = {
  title: "Empreses adjudicatàries",
  description:
    "Rànquing d'empreses per import total de contractes públics adjudicats a Catalunya.",
};

interface Props {
  searchParams: Promise<{ search?: string; cpv?: string; page?: string }>;
}

export default async function EmpresePage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";
  const cpv = (params.cpv || "")
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const parsedPage = parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;

  const [companies, exactTotal] = await Promise.all([
    fetchCompanies(offset, DEFAULT_PAGE_SIZE, search || undefined, cpv.length ? cpv : undefined),
    // The count is the heaviest query; don't let it take down the whole page.
    fetchCompaniesCount(search || undefined, cpv.length ? cpv : undefined).catch((error) => {
      console.error("fetchCompaniesCount failed:", error);
      return null;
    }),
  ]);
  // Fallback estimate keeps pagination usable: allow one more page if this one is full.
  const total =
    exactTotal ??
    offset + companies.length + (companies.length === DEFAULT_PAGE_SIZE ? DEFAULT_PAGE_SIZE : 0);

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
        adjudicats. Pots filtrar per empresa i també per sector CPV (codi o
        descripció) per veure qui concentra més activitat en cada àmbit.
      </p>

      <CompaniesTable
        initialData={companies}
        initialTotal={total}
        initialSearch={search}
        initialCpv={cpv}
        initialPage={page}
      />
    </div>
  );
}
