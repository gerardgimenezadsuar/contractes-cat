import { NextRequest, NextResponse } from "next/server";
import { fetchOpenTenders, fetchOpenTendersCount } from "@/lib/api";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toOpenTendersCsv(
  rows: Awaited<ReturnType<typeof fetchOpenTenders>>
): string {
  const header = [
    "codi_expedient",
    "denominacio",
    "objecte_contracte",
    "tipus_contracte",
    "procediment",
    "codi_cpv",
    "pressupost_licitacio_sense",
    "pressupost_licitacio_amb",
    "valor_estimat_contracte",
    "termini_presentacio_ofertes",
    "data_publicacio_anunci",
    "nom_organ",
    "enllac_publicacio",
  ];

  const lines = rows.map((r) => {
    const publicationUrl =
      typeof r.enllac_publicacio === "string"
        ? r.enllac_publicacio
        : r.enllac_publicacio?.url || "";
    return [
      r.codi_expedient,
      r.denominacio,
      r.objecte_contracte,
      r.tipus_contracte,
      r.procediment,
      r.codi_cpv,
      r.pressupost_licitacio_sense,
      r.pressupost_licitacio_amb,
      r.valor_estimat_contracte,
      r.termini_presentacio_ofertes,
      r.data_publicacio_anunci,
      r.nom_organ,
      publicationUrl,
    ]
      .map(csvEscape)
      .join(",");
  });

  return [header.join(","), ...lines].join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format");
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const filters = {
    tipus_contracte: searchParams.get("tipus_contracte") || undefined,
    procediment: searchParams.get("procediment") || undefined,
    amountMin: searchParams.get("amountMin") || undefined,
    amountMax: searchParams.get("amountMax") || undefined,
    nom_organ: searchParams.get("nom_organ") || undefined,
    search: searchParams.get("search") || undefined,
    cpvSearch: searchParams.get("cpvSearch") || undefined,
    page,
  };

  if (format === "csv") {
    const data = await fetchOpenTenders(filters);
    const csv = toOpenTendersCsv(data);
    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="licitacions-obertes-${timestamp}.csv"`,
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    });
  }

  const [data, total] = await Promise.all([
    fetchOpenTenders(filters),
    fetchOpenTendersCount(filters),
  ]);

  return NextResponse.json(
    { data, total },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
