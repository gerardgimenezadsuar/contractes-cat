import { NextRequest, NextResponse } from "next/server";
import { fetchContractsByAwardees, fetchContractsByAwardeesSummary } from "@/lib/api";
import { getPersonAwardeeTargets, loadPersonProfile } from "@/lib/borme";
import {
  API_ROUTE_S_MAXAGE_SECONDS,
  API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS,
} from "@/config/constants";

const SORT_MAP: Record<string, { orderBy: string; orderDir: "ASC" | "DESC" }> = {
  "date-desc": {
    orderBy: "coalesce(data_adjudicacio_contracte, data_formalitzacio_contracte, data_publicacio_anunci)",
    orderDir: "DESC",
  },
  "date-asc": {
    orderBy: "coalesce(data_adjudicacio_contracte, data_formalitzacio_contracte, data_publicacio_anunci)",
    orderDir: "ASC",
  },
  "amount-desc": { orderBy: "import_adjudicacio_sense::number", orderDir: "DESC" },
  "amount-asc": { orderBy: "import_adjudicacio_sense::number", orderDir: "ASC" },
};

interface Props {
  params: Promise<{ name: string }>;
}

function parseNifWindowsParam(raw: string) {
  return raw
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((chunk) => {
      const [nifRaw, fromRaw, toRaw] = chunk.split(",");
      const nif = (nifRaw || "").trim().toUpperCase();
      const dateFrom = (fromRaw || "").trim();
      const dateTo = (toRaw || "").trim();
      return {
        nif,
        dateFrom: /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : undefined,
        dateTo: /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : undefined,
      };
    })
    .filter((item) => /^[A-Z0-9]{8,12}$/.test(item.nif));
}

export async function GET(request: NextRequest, { params }: Props) {
  const { name } = await params;
  const decodedName = decodeURIComponent(name);

  const { searchParams } = request.nextUrl;
  const sortKey = searchParams.get("sort") || "date-desc";
  const sortOpts = SORT_MAP[sortKey] || SORT_MAP["date-desc"];
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const nomOrgan = (searchParams.get("nom_organ") || "").trim() || undefined;
  const dateFrom = (searchParams.get("date_from") || "").trim();
  const dateTo = (searchParams.get("date_to") || "").trim();
  const safeDateFrom = /^\d{4}-\d{2}-\d{2}$/.test(dateFrom) ? dateFrom : undefined;
  const safeDateTo = /^\d{4}-\d{2}-\d{2}$/.test(dateTo) ? dateTo : undefined;
  const nifWindowsParam = (searchParams.get("nif_windows") || "").trim();
  const nifDateWindows = parseNifWindowsParam(nifWindowsParam);
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
      orderBy: sortOpts.orderBy,
      orderDir: sortOpts.orderDir,
      nom_organ: nomOrgan,
      dateFrom: safeDateFrom,
      dateTo: safeDateTo,
      nifDateWindows,
    }),
    fetchContractsByAwardeesSummary({
      nifs,
      nom_organ: nomOrgan,
      dateFrom: safeDateFrom,
      dateTo: safeDateTo,
      nifDateWindows,
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
