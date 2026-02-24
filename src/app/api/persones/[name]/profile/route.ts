import { NextRequest, NextResponse } from "next/server";
import { loadPersonProfile } from "@/lib/borme";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

interface Props {
  params: Promise<{ name: string }>;
}

export async function GET(_request: NextRequest, { params }: Props) {
  const { name } = await params;
  const profile = await loadPersonProfile(decodeURIComponent(name));

  if (!profile) {
    return NextResponse.json(null, { status: 404 });
  }

  return NextResponse.json(profile, {
    headers: {
      "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
    },
  });
}
