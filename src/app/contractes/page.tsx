import type { Metadata } from "next";
import ContractExplorer from "./ContractExplorer";
import SharePageButton from "@/components/ui/SharePageButton";

export const metadata: Metadata = {
  title: "Explorador de contractes",
  description:
    "Explora tots els contractes públics a Catalunya amb filtres per any, tipus, procediment i import.",
};

interface Props {
  searchParams: Promise<{
    year?: string;
    tipus_contracte?: string;
    procediment?: string;
    amountMin?: string;
    amountMax?: string;
    nom_organ?: string;
    search?: string;
    page?: string;
  }>;
}

export default async function ContractesPage({ searchParams }: Props) {
  const params = await searchParams;
  const initialFilters = {
    year: params.year || "",
    tipus_contracte: params.tipus_contracte || "",
    procediment: params.procediment || "",
    amountMin: params.amountMin || "",
    amountMax: params.amountMax || "",
    nom_organ: params.nom_organ || "",
    search: params.search || "",
  };
  const initialPage = Math.max(1, parseInt(params.page || "1", 10) || 1);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">
          Explorador de contractes
        </h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-8">
        Cerca i filtra tots els contractes públics publicats a la plataforma de
        contractació pública de Catalunya.
      </p>
      <ContractExplorer initialFilters={initialFilters} initialPage={initialPage} />
    </div>
  );
}
