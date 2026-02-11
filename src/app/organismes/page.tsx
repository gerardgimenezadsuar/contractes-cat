import type { Metadata } from "next";
import { fetchOrgans, fetchOrgansCount } from "@/lib/api";
import OrgansTable from "@/components/tables/OrgansTable";
import { DEFAULT_PAGE_SIZE } from "@/config/constants";
import SharePageButton from "@/components/ui/SharePageButton";

export const revalidate = 21600;

export const metadata: Metadata = {
  title: "Organismes contractants",
  description:
    "Rànquing d'organismes per import total de contractes públics adjudicats a Catalunya.",
};

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function OrganismesPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = params.search || "";
  const page = parseInt(params.page || "1", 10);
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;

  const [organs, total] = await Promise.all([
    fetchOrgans(offset, DEFAULT_PAGE_SIZE, search || undefined),
    fetchOrgansCount(search || undefined),
  ]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Organismes contractants</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-8">
        Rànquing d&apos;organismes per import total adjudicat. Fes clic en un organisme per veure
        l&apos;evolució anual, les empreses adjudicatàries i els contractes recents.
      </p>

      <OrgansTable
        initialData={organs}
        initialTotal={total}
        initialSearch={search}
        initialPage={page}
      />
    </div>
  );
}
