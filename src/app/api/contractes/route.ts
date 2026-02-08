import { NextRequest, NextResponse } from "next/server";
import { fetchContracts, fetchContractsCount } from "@/lib/api";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, "\"\"")}"`;
  return str;
}

function toContractsCsv(
  rows: Awaited<ReturnType<typeof fetchContracts>>
): string {
  const header = [
    "codi_expedient",
    "denominacio",
    "tipus_contracte",
    "procediment",
    "denominacio_adjudicatari",
    "identificacio_adjudicatari",
    "import_adjudicacio_sense",
    "import_adjudicacio_amb_iva",
    "data_adjudicacio_contracte",
    "data_formalitzacio_contracte",
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
      r.tipus_contracte,
      r.procediment,
      r.denominacio_adjudicatari,
      r.identificacio_adjudicatari,
      r.import_adjudicacio_sense,
      r.import_adjudicacio_amb_iva,
      r.data_adjudicacio_contracte,
      r.data_formalitzacio_contracte,
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

  const filters = {
    year: searchParams.get("year") || undefined,
    tipus_contracte: searchParams.get("tipus_contracte") || undefined,
    procediment: searchParams.get("procediment") || undefined,
    amountMin: searchParams.get("amountMin") || undefined,
    amountMax: searchParams.get("amountMax") || undefined,
    nom_organ: searchParams.get("nom_organ") || undefined,
    search: searchParams.get("search") || undefined,
    page: parseInt(searchParams.get("page") || "1", 10),
  };

  if (format === "csv") {
    const data = await fetchContracts(filters);
    const csv = toContractsCsv(data);
    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="contractes-${timestamp}.csv"`,
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    });
  }

  const [data, total] = await Promise.all([
    fetchContracts(filters),
    fetchContractsCount(filters),
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
