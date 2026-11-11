import { fetchCompanyDetail } from "@/lib/api";
import { loadAdminHistory } from "@/lib/borme";
import { classifyControlRole } from "@/lib/borme-roles";
import { formatCompactEuros } from "@/lib/indicators";
import { OG_CONTENT_TYPE, OG_SIZE, renderCard } from "@/lib/og/card";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { cleanEntityName, currentControllers } from "@/lib/seo/entity-summary";
import { displayCompanyName } from "@/lib/company-names";
import { formatNumber } from "@/lib/utils";

export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface Props {
  params: Promise<{ id: string }>;
}

function names(people: { personName: string }[]): string {
  const shown = people.slice(0, 2).map((p) => formatPersonDisplayName(p.personName));
  const rest = people.length - shown.length;
  if (rest > 0) return `${shown.join(", ")} i ${rest === 1 ? "1 persona més" : `${rest} persones més`}`;
  return shown.join(" i ");
}

export default async function Image({ params }: Props) {
  const { id } = await params;
  const decodedId = decodeURIComponent(id);
  const [{ company, yearly }, adminHistory] = await Promise.all([
    fetchCompanyDetail(decodedId),
    loadAdminHistory(decodedId).catch(() => null),
  ]);

  const rawName = company?.denominacio_adjudicatari || decodedId;
  // All-caps register names read better title-cased; keep names that already have their own casing.
  const name = rawName === rawName.toUpperCase() ? displayCompanyName(rawName, false) : cleanEntityName(rawName);
  const totalAmount = parseFloat(company?.total || "0");
  const numContracts = parseInt(String(company?.num_contracts || "0"), 10);
  const years = yearly
    .filter((row) => (parseInt(row.num_contracts, 10) || 0) > 0)
    .map((row) => parseInt(row.year, 10))
    .filter(Number.isFinite);
  const period = years.length > 0 ? `${Math.min(...years)}–${Math.max(...years)}` : "—";

  const { owners, admins } = currentControllers(
    (adminHistory?.spans ?? []).map((span) => ({
      person_name: span.person_name,
      date_end: span.date_end,
      control: classifyControlRole(span.relation_type, span.role_title_code),
    }))
  );
  const summary =
    owners.length > 0
      ? `Soci únic: ${names(owners)}.${admins.length > 0 ? ` Administració: ${names(admins)}.` : ""}`
      : admins.length > 0
        ? `Administrada per ${names(admins)}, segons el BORME.`
        : `Contractes públics adjudicats a ${name} a Catalunya.`;

  return renderCard({
    eyebrow: "Empresa adjudicatària",
    title: name,
    summary,
    figures: [
      { label: "Total adjudicat", value: formatCompactEuros(totalAmount) },
      { label: "Contractes", value: formatNumber(numContracts) },
      { label: "Període", value: period },
    ],
    source:
      owners.length + admins.length > 0
        ? "Contractes de Transparència Catalunya · Administradors del BORME · IVA inclòs"
        : "Contractes de Transparència Catalunya · IVA inclòs",
  });
}
