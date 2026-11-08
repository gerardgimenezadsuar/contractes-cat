import type { Metadata } from "next";
import Link from "next/link";
import { cache, Suspense } from "react";
import {
  getPersonAwardeeTargets,
  getPersonControlTargets,
  isIndexablePerson,
  loadPersonProfile,
  serializeNifWindows,
  type BormePersonCompany,
  type BormePersonRoleSpan,
} from "@/lib/borme";
import { PROFESSIONAL_ADMIN_THRESHOLD } from "@/lib/borme-roles";
import { fetchContractsByAwardeesSummary } from "@/lib/api";
import { fetchPublicOfficeProfile } from "@/lib/electes";
import { formatCompactNumber, formatDate, formatNumber } from "@/lib/utils";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { safeJsonLd } from "@/lib/seo/jsonld";
import {
  buildEntityBreadcrumbJsonLd,
  buildEntityJsonLdGraph,
  buildEntityMetadata,
  buildEntityPrimaryJsonLd,
} from "@/lib/seo/entity-seo";
import StatCard from "@/components/ui/StatCard";
import SharePageButton from "@/components/ui/SharePageButton";
import PersonContractsSection, {
  PersonContractsSectionFallback,
} from "@/components/person/PersonContractsSection";
import { buildCompanyHref } from "@/lib/company-identity";

export const revalidate = 21600;

// No withFallback on this page: it is ISR-cached, so a degraded render (zeros
// standing in for a failed Socrata query) would be served for hours. Letting the
// error throw makes Next.js keep serving the last good version and retry later.

// Render on demand and cache via ISR. Do not read searchParams here: it would force
// per-request rendering. URL filters are read client-side in PersonContractsSection.
export async function generateStaticParams() {
  return [];
}

interface Props {
  params: Promise<{ name: string }>;
}

const getPersonProfile = cache(async (name: string) => loadPersonProfile(name));

/** Contracts of the companies the person owned or administered, only while they did. */
const getControlSummary = cache(async (name: string) => {
  const profile = await getPersonProfile(name);
  const targets = profile ? getPersonControlTargets(profile) : null;
  if (!targets || targets.nifs.length === 0) return { total: 0, totalAmount: 0 };
  return fetchContractsByAwardeesSummary({ nifs: targets.nifs, nifDateWindows: targets.windows });
});

/** Upper bound for comparison: every contract of every company the person had any role in. */
const getAllCompaniesSummary = cache(async (name: string) => {
  const profile = await getPersonProfile(name);
  const nifs = profile ? getPersonAwardeeTargets(profile).nifs : [];
  if (nifs.length === 0) return { total: 0, totalAmount: 0 };
  return fetchContractsByAwardeesSummary({ nifs });
});

const OTHER_ROLE_LABELS: Record<string, string> = {
  APODERADO: "Apoderat/da",
  LIQUIDADOR: "Liquidador/a",
  SOCIO: "Soci/a",
  ADMINISTRADOR: "Administració concursal o suplent",
};

function roleLabel(role: BormePersonRoleSpan): string {
  const code = (role.role_title_code || "").toUpperCase();
  if (role.control === "OWNER") return "Soci únic";
  if (role.control === "ADMIN") {
    if (code.includes("VICEPRESID")) return "Vicepresidència";
    if (code.includes("PRESIDEN")) return "Presidència";
    if (code.includes("CONS_DEL") || code.includes("CONS_EJECUT")) return "Conseller/a delegat/da";
    if (code.includes("SOLID")) return "Adm. solidari/ària";
    if (code.includes("CONJUNT") || code.includes("MANC")) return "Adm. mancomunat/da";
    if (code.includes("UNICO")) return "Adm. únic/a";
    return "Administració";
  }
  if (role.relation_type === "ORGANO_GOBIERNO") {
    if (code.includes("SECRETAR")) return "Secretari/ària";
    return "Conseller/a";
  }
  return OTHER_ROLE_LABELS[role.relation_type] || role.relation_type;
}

function yearOf(d: string | null): string {
  return d && d.length >= 4 ? d.slice(0, 4) : "";
}

function rolePeriod(role: BormePersonRoleSpan): string {
  const start = yearOf(role.date_start);
  if (!role.date_end) return start ? `des de ${start}` : "";
  const end = yearOf(role.date_end);
  return start === end ? start : `${start}–${end}`;
}

interface RoleChip {
  key: string;
  label: string;
  period: string;
  control: boolean;
  active: boolean;
}

/** Distinct role labels with their periods, control roles first. */
function roleChips(company: BormePersonCompany): RoleChip[] {
  const seen = new Set<string>();
  return [...company.roles]
    .sort((a, b) => Number(b.control !== null) - Number(a.control !== null) || b.date_start.localeCompare(a.date_start))
    .flatMap((role) => {
      const label = roleLabel(role);
      const period = rolePeriod(role);
      const key = `${label}|${period}`;
      if (seen.has(key)) return [];
      seen.add(key);
      return [{ key, label, period, control: role.control !== null, active: role.date_end === null }];
    });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const profile = await getPersonProfile(decodedName);

  const displayName = formatPersonDisplayName(profile?.person_name || decodedName);
  const bormeName = profile?.person_name || decodedName;

  const contractsSummary = await getControlSummary(decodedName);

  const description = profile
    ? `${displayName}: propietat o administració de ${formatNumber(profile.num_control_companies)} empreses, ${formatNumber(contractsSummary.total)} contractes públics durant el càrrec (${formatCompactNumber(contractsSummary.totalAmount)}). Informació societària del BORME i contractes públics a Catalunya.`
    : `Informació societària de ${displayName} segons BORME.`;

  const entityPath = `/persones/${encodeURIComponent(bormeName)}`;
  const metadata = buildEntityMetadata({
    title: displayName,
    description,
    path: entityPath,
    imagePath: `${entityPath}/opengraph-image`,
    imageAlt: `Perfil de contractació pública de ${displayName}`,
    keywords: [
      displayName,
      bormeName,
      `${displayName} contractes`,
      `${displayName} empreses`,
      "BORME",
      "contractació pública Catalunya",
    ],
    openGraphType: "profile",
  });
  // Only people linked to contract-winning companies are indexed (and listed in the sitemap).
  if (!isIndexablePerson(profile)) metadata.robots = { index: false, follow: true };
  return metadata;
}

function CompanyRoleList({ companies }: { companies: BormePersonCompany[] }) {
  return (
    <ul className="rounded-lg border border-gray-200 bg-white">
      {companies.map((company) => {
        const label = company.company_name_matched || company.company_name_borme;
        const chips = roleChips(company);
        const current = company.control ? company.control_active : company.active_spans > 0;
        return (
          <li
            key={`${company.company_name_borme}-${company.nif || "no-nif"}`}
            className="flex flex-col gap-2 border-b border-gray-100 px-4 py-3 last:border-b-0 md:flex-row md:items-start md:justify-between md:gap-6"
          >
            <div className="min-w-0">
              {company.nif ? (
                <Link href={buildCompanyHref(company.nif, label)} className="font-medium text-gray-900 hover:underline">
                  {label}
                </Link>
              ) : (
                <span className="font-medium text-gray-900">{label}</span>
              )}
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                {company.nif ? <span className="font-mono">{company.nif}</span> : <span>sense contractes públics</span>}
                <span className={current ? "text-emerald-700" : ""}>{current ? "Vigent" : "Històric"}</span>
              </div>
            </div>
            <ul className="flex flex-wrap gap-1.5 md:max-w-[55%] md:justify-end">
              {chips.map((chip) => (
                <li
                  key={chip.key}
                  className={`rounded px-1.5 py-0.5 text-xs ${
                    chip.control ? "bg-gray-900/5 text-gray-800" : "bg-gray-50 text-gray-500"
                  }`}
                >
                  {chip.label}
                  {chip.period ? <span className="text-gray-500"> · {chip.period}</span> : null}
                </li>
              ))}
            </ul>
          </li>
        );
      })}
    </ul>
  );
}

export default async function PersonDetailPage({ params }: Props) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);
  const profile = await getPersonProfile(decodedName);

  if (!profile) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <p className="text-gray-500">No s&apos;ha trobat la persona.</p>
        <Link href="/" className="text-blue-600 hover:underline mt-4 inline-block">
          Tornar a inici
        </Link>
      </div>
    );
  }

  const displayName = formatPersonDisplayName(profile.person_name);
  const personNameForHref = profile.person_name;
  const controlTargets = getPersonControlTargets(profile);
  const [contractsSummary, allCompaniesSummary, publicOffice] = await Promise.all([
    getControlSummary(decodedName),
    getAllCompaniesSummary(decodedName),
    fetchPublicOfficeProfile(profile.person_name),
  ]);
  const controlCompanies = profile.companies.filter((c) => c.control);
  const otherCompanies = profile.companies.filter((c) => !c.control);
  const activeControlCompanies = controlCompanies.filter((c) => c.control_active).length;

  function normalizeDate(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    const compactMatch = trimmed.match(/^(\d{4})(\d{2})(\d{2})$/);
    if (compactMatch) {
      const [, yyyy, mm, dd] = compactMatch;
      return `${yyyy}-${mm}-${dd}`;
    }
    const isoPrefix = trimmed.slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoPrefix)) return isoPrefix;
    const slashMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (slashMatch) {
      const [, dd, mm, yyyy] = slashMatch;
      return `${yyyy}-${mm}-${dd}`;
    }
    return null;
  }

  // Periods when the person owned or administered each company (not just any role).
  const companyWindowsByNif = new Map<string, Array<{ start: string; end: string | null }>>();
  for (const company of controlCompanies) {
    if (!company.nif) continue;
    const windows = companyWindowsByNif.get(company.nif) || [];
    for (const period of company.control_periods) {
      const start = normalizeDate(period.start);
      if (!start) continue;
      windows.push({ start, end: normalizeDate(period.end) });
    }
    companyWindowsByNif.set(company.nif, windows);
  }

  function rangesOverlap(
    startA: string,
    endA: string | null,
    startB: string,
    endB: string | null
  ): boolean {
    const aEnd = endA ?? "9999-12-31";
    const bEnd = endB ?? "9999-12-31";
    return startA <= bEnd && startB <= aEnd;
  }

  function maxDate(a: string, b: string): string {
    return a >= b ? a : b;
  }

  function minDateOrNull(a: string | null, b: string | null): string | null {
    if (a === null) return b;
    if (b === null) return a;
    return a <= b ? a : b;
  }

  function buildNifWindowParam(
    windows: Array<{ nif: string; dateFrom?: string; dateTo?: string }>
  ): string {
    return windows
      .map((window) => `${window.nif},${window.dateFrom || ""},${window.dateTo || ""}`)
      .join(";");
  }

  const overlapByPeriod = new Map<string, { total: number; totalAmount: number }>();
  const overlapByPeriodAndOrgan = new Map<string, { total: number; totalAmount: number }>();
  const eligibleNifWindowsByPeriod = new Map<
    string,
    Array<{ nif: string; dateFrom?: string; dateTo?: string }>
  >();
  if (controlTargets.nifs.length > 0 && publicOffice.periods.length > 0) {
    const overlapRows = await Promise.all(
      publicOffice.periods.map(async (period) => {
        if (!period.startDate) {
          return [
            period.key,
            { total: 0, totalAmount: 0 },
            { total: 0, totalAmount: 0 },
            [] as Array<{ nif: string; dateFrom?: string; dateTo?: string }>,
          ] as const;
        }
        const periodStart = period.startDate;
        const eligibleNifWindows = controlTargets.nifs.flatMap((nif) => {
          const windows = companyWindowsByNif.get(nif) || [];
          return windows
            .filter((window) => rangesOverlap(window.start, window.end, periodStart, period.endDate))
            .map((window) => ({
              nif,
              dateFrom: maxDate(periodStart, window.start),
              dateTo: minDateOrNull(period.endDate, window.end) || undefined,
            }));
        });
        if (eligibleNifWindows.length === 0) {
          return [
            period.key,
            { total: 0, totalAmount: 0 },
            { total: 0, totalAmount: 0 },
            eligibleNifWindows,
          ] as const;
        }
        const [summary, summaryByOrgan] = await Promise.all([
          fetchContractsByAwardeesSummary({
            nifs: controlTargets.nifs,
            nifDateWindows: eligibleNifWindows,
          }),
          fetchContractsByAwardeesSummary({
            nifs: controlTargets.nifs,
            nifDateWindows: eligibleNifWindows,
            nom_organ: period.ensName || undefined,
          }),
        ]);
        return [period.key, summary, summaryByOrgan, eligibleNifWindows] as const;
      })
    );
    for (const [key, summary, summaryByOrgan, eligibleNifWindows] of overlapRows) {
      overlapByPeriod.set(key, summary);
      overlapByPeriodAndOrgan.set(key, summaryByOrgan);
      eligibleNifWindowsByPeriod.set(key, eligibleNifWindows);
    }
  }

  const periodRangeCounts = new Map<string, number>();
  for (const period of publicOffice.periods) {
    const rangeKey = `${period.startDate || "none"}|${period.endDate || "open"}`;
    periodRangeCounts.set(rangeKey, (periodRangeCounts.get(rangeKey) || 0) + 1);
  }
  const periodRangeSeen = new Map<string, number>();
  const displayPeriods = publicOffice.periods.map((period) => {
    const rangeKey = `${period.startDate || "none"}|${period.endDate || "open"}`;
    const seen = (periodRangeSeen.get(rangeKey) || 0) + 1;
    periodRangeSeen.set(rangeKey, seen);
    return {
      period,
      isFirstInRange: seen === 1,
      rangeCount: periodRangeCounts.get(rangeKey) || 1,
    };
  });

  function buildPeriodContractsHref(period: (typeof publicOffice.periods)[number], onlyCurrentEns = false): string {
    const params = new URLSearchParams();
    if (period.startDate) params.set("date_from", period.startDate);
    if (period.endDate) params.set("date_to", period.endDate);
    const eligibleNifWindows = eligibleNifWindowsByPeriod.get(period.key) || [];
    if (eligibleNifWindows.length > 0) {
      const eligibleNifs = Array.from(new Set(eligibleNifWindows.map((w) => w.nif)));
      params.set("nifs", eligibleNifs.join(","));
      params.set("nif_windows", buildNifWindowParam(eligibleNifWindows));
    }
    if (onlyCurrentEns && period.ensName?.trim()) {
      params.set("nom_organ", period.ensName.trim());
    }
    return params.size
      ? `/persones/${encodeURIComponent(personNameForHref)}?${params.toString()}#contractes`
      : `/persones/${encodeURIComponent(personNameForHref)}#contractes`;
  }

  const uniqueRangeKeys = new Set(
    publicOffice.periods.map((period) => `${period.startDate || "none"}|${period.endDate || "open"}`)
  );
  const singleRangeSummary =
    uniqueRangeKeys.size === 1 && displayPeriods.length > 0
      ? (() => {
          const representative = displayPeriods[0].period;
          const summary = overlapByPeriod.get(representative.key) || { total: 0, totalAmount: 0 };
          return {
            total: summary.total,
            totalAmount: summary.totalAmount,
            href: buildPeriodContractsHref(representative, false),
          };
        })()
      : null;

  const personPath = `/persones/${encodeURIComponent(profile.person_name)}`;
  const personDescription = `${displayName}: vinculacions societàries i contractes públics a Catalunya.`;
  const jsonLd = buildEntityJsonLdGraph(
    buildEntityPrimaryJsonLd({
      schemaType: "Person",
      name: displayName,
      alternateName: profile.person_name,
      path: personPath,
      description: personDescription,
    }),
    buildEntityBreadcrumbJsonLd([
      { name: "Inici", path: "/" },
      { name: "Persones", path: "/persones" },
      { name: displayName },
    ])
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }}
      />

      <Link href="/" className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
        &larr; Tornar a inici
      </Link>

      <div className="mb-1 flex items-start justify-between gap-3">
        <h1 className="text-3xl font-bold text-gray-900">{displayName}</h1>
        <SharePageButton className="shrink-0" />
      </div>
      <p className="text-sm text-gray-500 mb-1">
        Nom al registre: <span className="font-medium text-gray-700">{profile.person_name}</span>
      </p>
      <p className="text-gray-600 mb-6">
        Càrrecs societaris extrets del BORME. Comptem com a vinculació la propietat (soci únic) i
        l&apos;administració (administradors, presidència i conseller delegat), i només els contractes que les
        empreses van guanyar mentre aquesta persona en tenia el càrrec.
      </p>

      {profile.is_professional_admin ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Aquest nom apareix com a propietari o administrador de {formatNumber(profile.num_control_companies)} empreses
          (més de {PROFESSIONAL_ADMIN_THRESHOLD}). Sovint correspon a un administrador professional (gestoria, despatx o
          societat de serveis) o a diverses persones amb el mateix nom, i no indica control real de cada empresa.
        </p>
      ) : null}
      {profile.ambiguous_name ? (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Nom curt: el BORME no publica el DNI, i és possible que aquest perfil agrupi diverses persones amb el mateix nom.
        </p>
      ) : null}

      <section className="mb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Empreses que controla o ha controlat"
          titleTooltip="Empreses on ha estat soci únic o administrador (inclosa presidència i conseller delegat)."
          value={formatNumber(profile.num_control_companies)}
          subtitle={`${formatNumber(profile.num_control_companies_with_nif)} amb contractes públics`}
          compact
        />
        <StatCard
          title="Amb control actual"
          value={formatNumber(activeControlCompanies)}
          subtitle="propietat o administració vigent"
          compact
        />
        <StatCard
          title="Contractes durant el càrrec"
          titleTooltip="Contractes adjudicats a les empreses que controlava, només dins del període en què n'era soci únic o administrador."
          value={formatNumber(contractsSummary.total)}
          subtitle={`Import: ${formatCompactNumber(contractsSummary.totalAmount)}${
            allCompaniesSummary.total > contractsSummary.total
              ? ` · ${formatNumber(allCompaniesSummary.total)} sense filtrar`
              : ""
          }`}
          compact
        />
        <StatCard
          title="Altres càrrecs"
          titleTooltip="Empreses on només consta com a apoderat, conseller, secretari, liquidador o administrador concursal. No compten com a vinculació."
          value={formatNumber(otherCompanies.length)}
          subtitle="apoderat, conseller, secretari…"
          compact
        />
      </section>
      {controlTargets.truncated ? (
        <p className="-mt-6 mb-8 text-xs text-gray-500">
          Per a perfils amb moltes empreses, el recompte de contractes considera els períodes de càrrec més recents.
        </p>
      ) : null}

      {publicOffice.periods.length > 0 ? (
        <section className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">Càrrecs públics</h2>
          <p className="mb-1 text-sm text-gray-500">Font: Transparència Catalunya</p>
          <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Avís: aquesta secció vincula càrrecs públics per coincidència de nom. La persona mostrada pot tenir un nom
            similar al d&apos;un càrrec electe i no haver ocupat necessàriament aquest càrrec.
          </p>
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden mb-8">
            {singleRangeSummary ? (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Aquesta persona té <span className="font-medium">{formatNumber(singleRangeSummary.total)} contractes</span> adjudicats a empreses vinculades mentre ocupava càrrec públic en aquest període. La taula mostra quants provenen de cada ens.{" "}
                <Link href={singleRangeSummary.href} className="text-blue-600 hover:underline">
                  Veure tots els contractes del període
                </Link>
                .
              </div>
            ) : (
              <div className="border-b border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
                Cada fila mostra quants contractes provenen de l&apos;ens on aquesta persona tenia càrrec durant el període indicat.
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-[760px] w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Ens</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Càrrec</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Període</th>
                    <th className="text-left py-2.5 px-3 font-medium text-gray-500">Contractes (ens)</th>
                  </tr>
                </thead>
                <tbody>
                  {displayPeriods.map(({ period, isFirstInRange, rangeCount }) => {
                    const overlapByOrgan = overlapByPeriodAndOrgan.get(period.key) || { total: 0, totalAmount: 0 };
                    const periodLabel = period.startDate
                      ? `${formatDate(period.startDate)} - ${period.endDate ? formatDate(period.endDate) : "actual"}`
                      : "No informat";
                    const inferLabel =
                      period.endDateInference === "successor"
                        ? "Fi inferit per nomenament d'una altra persona"
                        : period.endDateInference === "open"
                          ? "Sense successor publicat"
                          : "Sense data de nomenament";
                    const scrutinyHrefEns = buildPeriodContractsHref(period, true);

                    return (
                      <tr key={period.key} className="border-b border-gray-100 last:border-b-0 align-top">
                        <td className="py-2.5 px-3 text-gray-900">
                          <div className="font-medium">{period.ensName}</div>
                          <div className="text-xs text-gray-500">Codi: {period.codiEns}</div>
                        </td>
                        <td className="py-2.5 px-3 text-gray-700">
                          <div>{period.carrec}</div>
                          {period.partit ? (
                            <div className="text-xs text-gray-500 mt-1">Partit: {period.partit}</div>
                          ) : null}
                        </td>
                        {isFirstInRange ? (
                          <td rowSpan={rangeCount} className="py-2.5 px-3 text-gray-700 align-top">
                            <div>{periodLabel}</div>
                            <div className="text-xs text-gray-500 mt-1">{inferLabel}</div>
                          </td>
                        ) : null}
                        <td className="py-2.5 px-3 text-gray-700">
                          <div>{formatNumber(overlapByOrgan.total)} contractes</div>
                          <div className="text-xs text-gray-500 mt-1">{formatCompactNumber(overlapByOrgan.totalAmount)}</div>
                          <Link href={scrutinyHrefEns} className="mt-1 inline-block text-sm text-blue-600 hover:underline">
                            Veure contractes d&apos;aquest ens
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500">
              Les dates de fi es dedueixen quan el mateix càrrec rep un nomenament posterior d&apos;una altra persona.
            </div>
          </div>
        </section>
      ) : null}

      <section className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-1">Propietat i administració (BORME)</h2>
        <p className="mb-3 text-sm text-gray-500">
          Empreses on ha estat soci únic o administrador. El soci únic deixa de constar quan el BORME en publica un altre.
        </p>
        {controlCompanies.length > 0 ? (
          <CompanyRoleList companies={controlCompanies} />
        ) : (
          <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
            No consta com a propietari ni administrador de cap empresa.
          </p>
        )}
        {otherCompanies.length > 0 ? (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-accent hover:underline">
              Altres càrrecs ({formatNumber(otherCompanies.length)} empreses): apoderat, conseller, secretari…
            </summary>
            <div className="mt-3">
              <CompanyRoleList companies={otherCompanies} />
            </div>
          </details>
        ) : null}
      </section>

      <section id="contractes">
        <Suspense
          fallback={
            <PersonContractsSectionFallback
              totalContracts={contractsSummary.total}
              totalAmount={contractsSummary.totalAmount}
            />
          }
        >
          <PersonContractsSection
            personName={profile.person_name}
            defaultNifs={controlTargets.nifs}
            defaultNifWindows={serializeNifWindows(controlTargets.windows)}
            totalContracts={contractsSummary.total}
            totalAmount={contractsSummary.totalAmount}
          />
        </Suspense>
      </section>
    </div>
  );
}
