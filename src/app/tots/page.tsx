import type { Metadata } from "next";
import UnifiedSearch from "@/components/search/UnifiedSearch";
import SharePageButton from "@/components/ui/SharePageButton";

export const metadata: Metadata = {
  title: "Cerca contractes a Catalunya",
  description:
    "Cerca empreses, organismes i persones vinculades a la contractació pública a Catalunya.",
};

interface Props {
  searchParams: Promise<{ search?: string }>;
}

export default async function TotsPage({ searchParams }: Props) {
  const params = await searchParams;
  const search = (params.search || "").trim();

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-2 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">Cerca contractes a Catalunya</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-gray-600 mb-8">
        Cerca simultàniament entre empreses adjudicatàries, organismes públics i
        persones vinculades.
      </p>

      <UnifiedSearch initialSearch={search} />
    </div>
  );
}
