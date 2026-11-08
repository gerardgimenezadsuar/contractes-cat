import type { Metadata } from "next";
import SharePageButton from "@/components/ui/SharePageButton";
import PersonSearchExplorer from "@/components/person/PersonSearchExplorer";
import PersonesTopVinculacioTable from "@/components/person/PersonesTopVinculacioTable";
import { loadTopVinculacions } from "@/lib/persones-top";

export const metadata: Metadata = {
  title: { absolute: "Qui controla les empreses que guanyen contractes públics a Catalunya" },
  description:
    "Rànquing de propietaris i administradors (BORME) per l'import dels contractes públics que van guanyar les seves empreses mentre en tenien el càrrec. Cerca qualsevol persona i les empreses que controla.",
  alternates: { canonical: "/persones" },
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
        <h1 className="text-3xl font-bold text-gray-900">Qui controla les empreses que guanyen contractes públics</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="mb-2 max-w-4xl text-gray-600">
        Creuem el Registre Mercantil (BORME) amb els contractes públics de Catalunya: per a cada persona sabem de quines
        empreses és o ha estat propietària (soci únic) o administradora, i quants contractes van guanyar aquestes empreses
        mentre en tenia el càrrec.
      </p>
      <p className="mb-6 max-w-4xl text-gray-600">
        Cerca per nom per veure les empreses que controla una persona, o consulta el rànquing de més avall.
      </p>

      <PersonSearchExplorer initialQuery={rawSearch} initialPage={page} />
      <PersonesTopVinculacioTable rows={topRows} />
    </div>
  );
}
