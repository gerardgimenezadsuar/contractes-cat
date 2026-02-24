import { NextRequest, NextResponse } from "next/server";
import { loadAdminHistory } from "@/lib/borme";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

interface Props {
  params: Promise<{ nif: string }>;
}

export async function GET(_request: NextRequest, { params }: Props) {
  const { nif } = await params;
  const data = await loadAdminHistory(decodeURIComponent(nif));

  if (!data) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(data, {
    headers: {
      "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
    },
  });
}
