import { fetchCompanyContracts, fetchCompanyDetail } from "@/lib/api";
import { isAmbiguousCompanyId, buildCompanyHref } from "@/lib/company-identity";
import { buildContractsFeed, companyFeedPath, feedResponse, FEED_ITEMS } from "@/lib/feeds";

/** RSS feed of the newest contracts won by a company (by NIF). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const nif = decodeURIComponent(id).trim();
  // Masked ids (self-employed people) are not one company; no feed for them.
  if (!nif || isAmbiguousCompanyId(nif)) return new Response("Not found", { status: 404 });

  const { company } = await fetchCompanyDetail(nif);
  if (!company) return new Response("Not found", { status: 404 });

  const contracts = await fetchCompanyContracts(nif, undefined, 0, FEED_ITEMS + 10);
  const name = company.denominacio_adjudicatari;
  return feedResponse(
    buildContractsFeed({
      title: `${name}: contractes públics (contractes.cat)`,
      description: `Darrers contractes públics adjudicats a ${name} (NIF ${nif}) a Catalunya.`,
      pagePath: buildCompanyHref(company.identificacio_adjudicatari, name),
      feedPath: companyFeedPath(nif),
      contracts,
      counterparty: "organ",
    })
  );
}
