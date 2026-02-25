import type { Metadata } from "next";
import SharePageButton from "@/components/ui/SharePageButton";
import PersonSearchExplorer from "@/components/person/PersonSearchExplorer";
import PersonesTopVinculacioTable from "@/components/person/PersonesTopVinculacioTable";
import { loadTopVinculacions } from "@/lib/persones-top";

export const metadata: Metadata = {
  title: "Persones vinculades (BORME)",
  description:
    "Cerca de persones amb càrrecs societaris en empreses vinculades a contractació pública a Catalunya.",
};

interface Props {
  searchParams: Promise<{ search?: string; page?: string }>;
}

export default async function PersonesPage({ searchParams }: Props) {
  const params = await searchParams;
  const rawSearch = (params.search || "").trim();
  const parsedPage = parseInt(params.page || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const topRows = await loadTopVinculacions();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Persones vinculades (BORME)</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-6">
        Cerca per nom de persona per veure les seves vinculacions societàries i els contractes públics de les empreses on participa.
      </p>

      <PersonSearchExplorer initialQuery={rawSearch} initialPage={page} />
      <PersonesTopVinculacioTable rows={topRows} />
    </div>
  );
}
