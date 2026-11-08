import { SITE_URL, API_ROUTE_S_MAXAGE_SECONDS, API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS } from "@/config/constants";
import type { Contract } from "@/lib/types";
import { buildCompanyHref } from "@/lib/company-identity";
import { formatCurrencyFull, getBestAvailableContractDate, getPublicationUrl } from "@/lib/utils";

/** Newest contracts per feed; readers only need what is new since their last poll. */
export const FEED_ITEMS = 30;

/**
 * Feeds live under /api/ on purpose: feed readers are bots, and the Vercel
 * firewall's managed Bot Protection challenges every non-browser client except
 * on /api/*, which has a bypass rule.
 */
export function companyFeedPath(nif: string): string {
  return `/api/feeds/empreses/${encodeURIComponent(nif)}`;
}

export function organFeedPath(organName: string): string {
  return `/api/feeds/organismes/${encodeURIComponent(organName)}`;
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function contractDate(contract: Contract): Date | null {
  const { date } = getBestAvailableContractDate(
    contract.data_adjudicacio_contracte,
    contract.data_formalitzacio_contracte,
    contract.data_publicacio_anunci
  );
  if (!date) return null;
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

interface FeedInput {
  title: string;
  description: string;
  /** Page the feed belongs to, e.g. /empreses/B123. */
  pagePath: string;
  feedPath: string;
  contracts: Contract[];
  /** What the item title leads with: the other party of each contract. */
  counterparty: "organ" | "company";
}

export function buildContractsFeed(input: FeedInput): string {
  // Some records carry dates years in the future; keep them out of the feed.
  const cutoff = Date.now() + 24 * 3600 * 1000;
  const items = input.contracts
    .map((contract) => ({ contract, date: contractDate(contract) }))
    .filter((row): row is { contract: Contract; date: Date } => row.date !== null && row.date.getTime() <= cutoff)
    .slice(0, FEED_ITEMS);

  const pageUrl = `${SITE_URL}${input.pagePath}`;
  const itemXml = items
    .map(({ contract, date }) => {
      const other =
        input.counterparty === "organ" ? contract.nom_organ : contract.denominacio_adjudicatari?.split("||")[0];
      const amount = contract.import_adjudicacio_amb_iva || contract.import_adjudicacio_sense;
      const subject = (contract.denominacio || contract.objecte_contracte || "Contracte").trim();
      const title = [formatCurrencyFull(amount), other, subject].filter(Boolean).join(" · ");
      const link = getPublicationUrl(contract.enllac_publicacio) || pageUrl;
      const otherLink =
        input.counterparty === "organ"
          ? contract.nom_organ
            ? `${SITE_URL}/organismes/${encodeURIComponent(contract.nom_organ)}`
            : null
          : contract.identificacio_adjudicatari && !contract.identificacio_adjudicatari.includes("||")
            ? `${SITE_URL}${buildCompanyHref(contract.identificacio_adjudicatari, contract.denominacio_adjudicatari)}`
            : null;
      const description = [
        subject,
        contract.procediment ? `Procediment: ${contract.procediment}` : null,
        contract.tipus_contracte ? `Tipus: ${contract.tipus_contracte}` : null,
        otherLink ? `Més a contractes.cat: ${otherLink}` : null,
      ]
        .filter(Boolean)
        .join("\n");
      const guid = `${contract.codi_expedient || ""}|${contract.numero_lot || ""}|${contract.identificacio_adjudicatari || ""}|${date.toISOString().slice(0, 10)}`;
      return [
        "    <item>",
        `      <title>${xmlEscape(title)}</title>`,
        `      <link>${xmlEscape(link)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(guid)}</guid>`,
        `      <pubDate>${date.toUTCString()}</pubDate>`,
        `      <description>${xmlEscape(description)}</description>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const lastBuild = items[0]?.date ?? new Date();
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
    "  <channel>",
    `    <title>${xmlEscape(input.title)}</title>`,
    `    <link>${xmlEscape(pageUrl)}</link>`,
    `    <description>${xmlEscape(input.description)}</description>`,
    "    <language>ca</language>",
    `    <lastBuildDate>${lastBuild.toUTCString()}</lastBuildDate>`,
    `    <atom:link href="${xmlEscape(`${SITE_URL}${input.feedPath}`)}" rel="self" type="application/rss+xml"/>`,
    itemXml,
    "  </channel>",
    "</rss>",
    "",
  ].join("\n");
}

export function feedResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
      "Cache-Control": `public, s-maxage=${API_ROUTE_S_MAXAGE_SECONDS}, stale-while-revalidate=${API_ROUTE_STALE_WHILE_REVALIDATE_SECONDS}`,
    },
  });
}
