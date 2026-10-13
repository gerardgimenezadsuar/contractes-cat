import { NextRequest, NextResponse } from "next/server";
import { fetchCompanies, fetchCompaniesCount } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, "\"\"")}"`;
  return str;
}

function toCompaniesCsv(
  rows: Awaited<ReturnType<typeof fetchCompanies>>
): string {
  const header = [
    "identificacio_adjudicatari",
    "denominacio_adjudicatari",
    "total",
    "num_contracts",
  ];
  const lines = rows.map((r) =>
    [
      r.identificacio_adjudicatari,
      r.denominacio_adjudicatari,
      r.total,
      r.num_contracts,
    ]
      .map(csvEscape)
      .join(",")
  );
  return [header.join(","), ...lines].join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format");
  const rawSearch = (searchParams.get("search") || "").trim();
  const rawCpv = (searchParams.get("cpv") || "").trim();
  const search = rawSearch.length >= 2 ? rawSearch : "";
  const cpvFilters = rawCpv
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  const includeTotal = searchParams.get("includeTotal") !== "0";
  const includeCurrentYear = searchParams.get("includeCurrentYear") !== "0";
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;

  if (format === "csv") {
    const data = await fetchCompanies(
      offset,
      DEFAULT_PAGE_SIZE,
      search || undefined,
      cpvFilters.length > 0 ? cpvFilters : undefined
    );
    const csv = toCompaniesCsv(data);
    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="empreses-${timestamp}.csv"`,
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    });
  }

  // List and count run concurrently; for a search they share the same
  // candidate query, so this costs a single Socrata round trip.
  const dataPromise = fetchCompanies(
    offset,
    DEFAULT_PAGE_SIZE,
    search || undefined,
    cpvFilters.length > 0 ? cpvFilters : undefined,
    { includeCurrentYear }
  );
  const totalPromise = includeTotal
    ? fetchCompaniesCount(search || undefined, cpvFilters.length > 0 ? cpvFilters : undefined).catch(
        (error: unknown) => {
          console.error("fetchCompaniesCount failed:", error);
          return undefined;
        }
      )
    : Promise.resolve(undefined);
  const [data, total] = await Promise.all([dataPromise, totalPromise]);

  if (!includeTotal) {
    return NextResponse.json(
      { data },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
        },
      }
    );
  }

  if (total === undefined) {
    // Return the rows anyway; the client keeps its previous total.
    return NextResponse.json({ data }, { headers: { "Cache-Control": "no-store" } });
  }

  return NextResponse.json(
    { data, total },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
