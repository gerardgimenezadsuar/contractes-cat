import { fetchOrganDetail } from "@/lib/api";
import { formatCompactEuros } from "@/lib/indicators";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og/card";
import { cleanEntityName } from "@/lib/seo/entity-summary";
import { formatNumber } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const { organ, yearly } = await fetchOrganDetail(decodedId);

  const name = cleanEntityName(organ?.nom_organ || decodedId);
  const totalAmount = parseFloat(organ?.total || "0");
  const numContracts = parseInt(String(organ?.num_contracts || "0"), 10);
  const lastYear = yearly
    .map((row) => ({ year: parseInt(row.year, 10), total: parseFloat(row.total || "0") }))
    .filter((row) => Number.isFinite(row.year) && row.total > 0 && row.year < new Date().getFullYear())
    .sort((a, b) => b.year - a.year)[0];

  return renderCard({
    eyebrow: "Organisme contractant",
    title: name,
    summary: "A quines empreses adjudica contractes, per quin import i qui les controla.",
    figures: [
      { label: "Total adjudicat", value: formatCompactEuros(totalAmount) },
      { label: "Contractes", value: formatNumber(numContracts) },
      lastYear
        ? { label: `Adjudicat el ${lastYear.year}`, value: formatCompactEuros(lastYear.total) }
        : { label: "Adjudicat l'últim any", value: "—" },
    ],
    source: "Contractes de Transparència Catalunya · IVA inclòs",
  });
}
