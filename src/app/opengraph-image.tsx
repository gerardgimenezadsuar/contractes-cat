import { fetchTotalAmount, fetchTotalContracts, fetchUniqueCompanies } from "@/lib/api";
import { formatCompactEuros } from "@/lib/indicators";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og/card";
import { formatNumber } from "@/lib/utils";

// Site card: the home page and any page without its own image.
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;
export const alt = "contractes.cat: contractació pública a Catalunya";
export const revalidate = 86400;

export default async function Image() {
  const [totalContracts, totalAmount, uniqueCompanies] = await Promise.all([
    fetchTotalContracts(),
    fetchTotalAmount(),
    fetchUniqueCompanies(),
  ]);
  return renderCard({
    eyebrow: "Contractació pública a Catalunya",
    title: "Qui guanya els contractes públics, i qui hi ha al darrere",
    summary: "Cada contracte adjudicat a Catalunya, amb els propietaris i administradors de les empreses segons el BORME.",
    figures: [
      { label: "Contractes", value: formatNumber(totalContracts) },
      { label: "Import adjudicat", value: formatCompactEuros(Number(totalAmount) || 0) },
      { label: "Empreses", value: formatNumber(uniqueCompanies) },
    ],
    source: "Dades obertes · Transparència Catalunya + BORME · Projecte independent",
  });
}
