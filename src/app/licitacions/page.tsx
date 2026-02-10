import type { Metadata } from "next";
import OpenTenderExplorer from "./OpenTenderExplorer";
import SharePageButton from "@/components/ui/SharePageButton";

export const metadata: Metadata = {
  title: "Licitacions obertes",
  description:
    "Troba licitacions en període de presentació d'ofertes i filtra-les per sector CPV, tipus, procediment i pressupost.",
};

interface Props {
  searchParams: Promise<{
    tipus_contracte?: string;
    procediment?: string;
    amountMin?: string;
    amountMax?: string;
    nom_organ?: string;
    search?: string;
    cpvSearch?: string;
    page?: string;
  }>;
}

export default async function LicitacionsPage({ searchParams }: Props) {
  const params = await searchParams;

  const initialFilters = {
    tipus_contracte: params.tipus_contracte || "",
    procediment: params.procediment || "",
    amountMin: params.amountMin || "",
    amountMax: params.amountMax || "",
    nom_organ: params.nom_organ || "",
    search: params.search || "",
    cpvSearch: params.cpvSearch || "",
  };
  const initialPage = Math.max(1, parseInt(params.page || "1", 10) || 1);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Licitacions obertes</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-8">
        Oportunitats de contractació pública en fase d&apos;anunci i amb termini de presentació d&apos;ofertes obert.
      </p>

      <OpenTenderExplorer initialFilters={initialFilters} initialPage={initialPage} />
    </div>
  );
}
