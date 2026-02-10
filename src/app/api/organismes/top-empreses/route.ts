import { NextRequest, NextResponse } from "next/server";
import { fetchOrganTopCompanies } from "@/lib/api";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const organ = searchParams.get("organ") || "";
  const limit = parseInt(searchParams.get("limit") || "10", 10);
  const nearDirectAwardOnly = searchParams.get("near_direct_award") === "1";
  const rawYear = searchParams.get("year");
  const parsedYear = rawYear && /^\d{4}$/.test(rawYear) ? Number(rawYear) : null;
  const currentYear = new Date().getFullYear();
  const year = parsedYear !== null && parsedYear >= 2000 && parsedYear <= currentYear + 1
    ? parsedYear
    : undefined;

  if (!organ.trim()) {
    return NextResponse.json({ data: [] }, { status: 400 });
  }

  const data = await fetchOrganTopCompanies(
    organ,
    Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 10,
    year !== undefined || nearDirectAwardOnly
      ? {
          ...(year !== undefined ? { year } : {}),
          ...(nearDirectAwardOnly ? { nearDirectAwardOnly: true } : {}),
        }
      : undefined
  );

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
