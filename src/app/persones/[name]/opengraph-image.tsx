import { fetchContractsByAwardeesSummary } from "@/lib/api";
import { getPersonControlTargets, loadPersonProfile } from "@/lib/borme";
import { formatCompactEuros } from "@/lib/indicators";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og/card";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { formatNumber } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ name: string }>;
}

export default async function Image({ params }: Props) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const profile = await loadPersonProfile(decodedName);
  const displayName = formatPersonDisplayName(profile?.person_name || decodedName);
  const numCompanies = profile?.num_control_companies || 0;

  // Same scope as the page headline: companies owned or administered, while they were.
  const targets = profile ? getPersonControlTargets(profile) : { nifs: [], windows: [], truncated: false };
  const summary =
    targets.nifs.length > 0
      ? await fetchContractsByAwardeesSummary({ nifs: targets.nifs, nifDateWindows: targets.windows })
      : { total: 0, totalAmount: 0 };

  const companies = numCompanies === 1 ? "1 empresa" : `${formatNumber(numCompanies)} empreses`;
  return renderCard({
    eyebrow: "Persona · BORME",
    title: displayName,
    summary:
      summary.total > 0
        ? `Propietat o administració de ${companies}, que van guanyar ${formatNumber(summary.total)} contractes públics mentre en tenia el càrrec.`
        : `Propietat o administració de ${companies} segons el BORME.`,
    figures: [
      { label: "Empreses", value: formatNumber(numCompanies) },
      { label: "Contractes en el càrrec", value: formatNumber(summary.total) },
      { label: "Import sense IVA", value: formatCompactEuros(Number(summary.totalAmount) || 0) },
    ],
    source: "Càrrecs del BORME + contractes de Transparència Catalunya",
  });
}
