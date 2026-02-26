import { NextRequest, NextResponse } from "next/server";
import { fetchContractsByAwardees, fetchContractsByAwardeesSummary } from "@/lib/api";
import { getPersonAwardeeTargets, loadPersonProfile } from "@/lib/borme";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";
import { parseSortParam, COLUMN_ORDER_EXPR } from "@/lib/table-types";

interface Props {
  params: Promise<{ name: string }>;
}

export async function GET(request: NextRequest, { params }: Props) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  const { searchParams } = request.nextUrl;
  const sortState = parseSortParam(searchParams.get("sort"));
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const nomOrgan = (searchParams.get("nom_organ") || "").trim() || undefined;
  const nifsParam = (searchParams.get("nifs") || "").trim();

  let nifs: string[] = nifsParam
    .split(",")
    .map((v) => v.trim().toUpperCase())
    .filter((v) => /^[A-Z0-9]{8,12}$/.test(v));
  nifs = Array.from(new Set(nifs));

  if (nifs.length === 0) {
    const personProfile = await loadPersonProfile(decodedName);
    if (!personProfile) {
      return NextResponse.json({ data: [], total: 0 }, { status: 404 });
    }
    const targets = getPersonAwardeeTargets(personProfile);
    nifs = targets.nifs;
  }

  if (nifs.length === 0) {
    return NextResponse.json(
      { data: [], total: 0 },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
        },
      }
    );
  }

  const [data, summary] = await Promise.all([
    fetchContractsByAwardees({
      nifs,
      page,
      orderBy: COLUMN_ORDER_EXPR[sortState.column],
      orderDir: sortState.dir.toUpperCase() as "ASC" | "DESC",
      nom_organ: nomOrgan,
    }),
    fetchContractsByAwardeesSummary({
      nifs,
      nom_organ: nomOrgan,
    }),
  ]);

  return NextResponse.json(
    { data, total: summary.total, totalAmount: summary.totalAmount },
    {
      headers: {
        "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
      },
    }
  );
}
