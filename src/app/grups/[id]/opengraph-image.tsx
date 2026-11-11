import { loadCompanyGroup } from "@/lib/borme";
import { displayCompanyName } from "@/lib/company-names";
import { formatCompactEuros } from "@/lib/indicators";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og/card";
import { formatNumber } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ id: string }>;
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const groupId = Number.parseInt(id, 10);
  const data = Number.isFinite(groupId) && groupId > 0 ? await loadCompanyGroup(groupId) : null;
  const group = data?.group;
  const name = group ? displayCompanyName(group.rootName, false) : "Grup empresarial";

  return renderCard({
    eyebrow: "Grup empresarial · BORME",
    title: `Grup ${name}`,
    summary: group
      ? `${formatNumber(group.size)} empreses del grup segons el BORME, ${formatNumber(group.numContractors)} amb contractes públics a Catalunya.`
      : undefined,
    figures: group
      ? [
          { label: "Empreses", value: formatNumber(group.size) },
          { label: "Contractes", value: formatNumber(group.numContracts) },
          { label: "Total adjudicat", value: formatCompactEuros(group.totalAmount) },
        ]
      : [],
    source: "Estructura del BORME · Contractes de Transparència Catalunya · IVA inclòs",
  });
}
