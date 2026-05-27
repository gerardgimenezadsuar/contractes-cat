import { NextRequest, NextResponse } from "next/server";
import { fetchOrganTopCompanies } from "@/lib/api";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

export const runtime = "edge";
export const preferredRegion = ["cdg1"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const organ = searchParams.get("organ") || "";
  const limit = parseInt(searchParams.get("limit") || "10", 10);

  if (!organ.trim()) {
    return NextResponse.json({ data: [] }, { status: 400 });
  }

  const data = await fetchOrganTopCompanies(organ, Number.isFinite(limit) ? Math.max(1, Math.min(limit, 50)) : 10);

  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
