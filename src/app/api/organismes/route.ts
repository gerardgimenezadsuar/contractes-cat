import { NextRequest, NextResponse } from "next/server";
import { fetchOrgans, fetchOrgansCount } from "@/lib/api";
import {
  DEFAULT_PAGE_SIZE,
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

function csvEscape(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function toOrgansCsv(rows: Awaited<ReturnType<typeof fetchOrgans>>): string {
  const header = ["nom_organ", "total", "num_contracts"];
  const lines = rows.map((r) => [r.nom_organ, r.total, r.num_contracts].map(csvEscape).join(","));
  return [header.join(","), ...lines].join("\n");
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const format = searchParams.get("format");
  const rawSearch = (searchParams.get("search") || "").trim();
  const search = rawSearch.length >= 2 ? rawSearch : "";
  const includeTotal = searchParams.get("includeTotal") !== "0";
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;

  if (format === "csv") {
    const data = await fetchOrgans(offset, DEFAULT_PAGE_SIZE, search || undefined);
    const csv = toOrgansCsv(data);
    const timestamp = new Date().toISOString().slice(0, 10);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="organismes-${timestamp}.csv"`,
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    });
  }

  const data = await fetchOrgans(offset, DEFAULT_PAGE_SIZE, search || undefined);

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

  const total = await fetchOrgansCount(search || undefined);

  return NextResponse.json(
    { data, total },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
