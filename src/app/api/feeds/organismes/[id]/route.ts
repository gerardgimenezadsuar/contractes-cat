import { fetchOrganContracts, fetchOrganDetail } from "@/lib/api";
import { buildContractsFeed, feedResponse, FEED_ITEMS, organFeedPath } from "@/lib/feeds";

/** RSS feed of the newest contracts awarded by a public body. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organName = decodeURIComponent(id).trim();
  if (!organName) return new Response("Not found", { status: 404 });

  const { organ } = await fetchOrganDetail(organName);
  if (!organ) return new Response("Not found", { status: 404 });

  const contracts = await fetchOrganContracts(organ.nom_organ, 0, FEED_ITEMS + 10);
  return feedResponse(
    buildContractsFeed({
      title: `${organ.nom_organ}: contractes públics (contractes.cat)`,
      description: `Darrers contractes públics adjudicats per ${organ.nom_organ}.`,
      pagePath: `/organismes/${encodeURIComponent(organ.nom_organ)}`,
      feedPath: organFeedPath(organ.nom_organ),
      contracts,
      counterparty: "company",
    })
  );
}
