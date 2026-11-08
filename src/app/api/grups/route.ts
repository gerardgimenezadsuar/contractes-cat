import { NextRequest, NextResponse } from "next/server";
import { searchGroups } from "@/lib/group-search";
import { API_ROUTE_S_MAXAGE_SECONDS, API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS } from "@/config/constants";

/** Business groups (BORME) matching a name or NIF, for the unified search box. */
export async function GET(request: NextRequest) {
  const search = (request.nextUrl.searchParams.get("search") || "").trim();
  const data = search.length >= 2 ? await searchGroups(search, 5) : [];
  return NextResponse.json(
    { data },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
