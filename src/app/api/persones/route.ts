import { NextRequest, NextResponse } from "next/server";
import { searchPersonsWithTotal } from "@/lib/borme";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
  DEFAULT_PAGE_SIZE,
} from "@/config/constants";

export const preferredRegion = ["cdg1"];

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const rawSearch = (searchParams.get("search") || "").trim();
  const search = rawSearch.length >= 3 ? rawSearch : "";
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const offset = (page - 1) * DEFAULT_PAGE_SIZE;

  if (!search) {
    return NextResponse.json(
      { data: [], total: 0 },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
        },
      }
    );
  }

  const { data, total } = await searchPersonsWithTotal(search, offset, DEFAULT_PAGE_SIZE);

  return NextResponse.json(
    { data, total },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
