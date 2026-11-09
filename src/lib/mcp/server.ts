/**
 * MCP server for AI assistants (Claude, ChatGPT, Codex, Cursor…).
 *
 * Read-only tools over the same data the site shows: public contracts in
 * Catalonia (Socrata) joined to BORME owners/administrators (Turso). Every
 * result carries the contractes.cat URL so assistants can cite a page the
 * user can open. Mounted at /api/mcp (see src/app/api/mcp/route.ts), which the
 * firewall already treats as API traffic.
 */
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import {
  fetchCompanies,
  fetchCompaniesCount,
  fetchCompanyContracts,
  fetchCompanyDetail,
  fetchCompanyTopOrgans,
  fetchContracts,
  fetchContractsByAwardees,
  fetchContractsByAwardeesSummary,
  fetchContractsCount,
  fetchOrgans,
  fetchOrganTopCompanies,
} from "@/lib/api";
import {
  getPersonControlTargets,
  loadAdminHistory,
  loadCompanyGroupByNif,
  loadPersonProfile,
  searchPersonsWithTotal,
} from "@/lib/borme";
import { isEntityName } from "@/lib/borme-format";
import { classifyControlRole } from "@/lib/borme-roles";
import { buildCompanyHref } from "@/lib/company-identity";
import { formatPersonDisplayName } from "@/lib/person-utils";
import { buildPersonAnswer, cleanEntityName, currentControllers } from "@/lib/seo/entity-summary";
import { formatCompactEuros } from "@/lib/indicators";
import { formatNumber } from "@/lib/utils";
import { SITE_URL } from "@/config/constants";
import type { Contract } from "@/lib/types";

export const MCP_INSTRUCTIONS = `contractes.cat is an independent open-data project (not an official government site) about public procurement in Catalonia.
It combines every contract published on the Generalitat de Catalunya transparency portal with the owners and administrators of the winning companies from the Spanish companies register (BORME).

Use it for questions like: which public contracts did a company win, who owns or runs it, which companies a person controls and what contracts those won while they were in charge, or which companies a public body awards the most.

Scope and privacy: all data comes from public records (the Generalitat transparency portal and BORME). People appear only in their business role as owners or administrators of companies; the tools never return addresses, ID numbers, contact details or other personal data, and never modify anything.

Tips:
- Names of people in BORME are surname-first ("LAPORTA ESTRUCH JOAN"); get_person also accepts the natural order. Use search_people when unsure.
- A person's contracts only count while they owned or administered the company. BORME has no national ID numbers, so short or common names can merge several people (results flag this).
- Company and public-body totals include VAT; person totals exclude VAT. Say which one you report.
- Results include "url" fields linking to the matching contractes.cat page, where the user can check the source.`;

const MAX_PAGE_SIZE = 25;

function url(path: string): string {
  return `${SITE_URL}${path}`;
}

function personUrl(bormeName: string): string {
  return url(`/persones/${encodeURIComponent(bormeName)}`);
}

function organUrl(organ: string): string {
  return url(`/organismes/${encodeURIComponent(organ)}`);
}

function companyUrl(nif: string, name: string): string {
  return url(buildCompanyHref(nif, name));
}

function num(value: string | number | null | undefined): number {
  const n = typeof value === "number" ? value : parseFloat(value ?? "");
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** YYYYMMDD (BORME) or ISO → YYYY-MM-DD. */
function isoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compact) return `${compact[1]}-${compact[2]}-${compact[3]}`;
  return /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : null;
}

function compactContract(c: Contract) {
  return {
    title: c.denominacio || c.objecte_contracte || null,
    public_body: c.nom_organ || null,
    awardee: c.denominacio_adjudicatari ? cleanEntityName(c.denominacio_adjudicatari) : null,
    awardee_nif: c.identificacio_adjudicatari || null,
    amount_eur_without_vat: c.import_adjudicacio_sense ? num(c.import_adjudicacio_sense) : null,
    award_date: isoDate(c.data_adjudicacio_contracte),
    type: c.tipus_contracte || null,
    procedure: c.procediment || null,
    bids_received: c.ofertes_rebudes ?? null,
    file_id: c.codi_expedient || null,
  };
}

function json(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

function notFound(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

const READ_ONLY = { readOnlyHint: true, openWorldHint: false, destructiveHint: false } as const;

const pageField = z.number().int().min(1).max(100).default(1).describe("1-based page number");

export function registerContractesTools(server: McpServer): void {
  server.registerTool(
    "search_companies",
    {
      title: "Search companies",
      description:
        "Find companies that won public contracts in Catalonia by name or tax ID (NIF), ranked by total awarded amount. Returns NIF, totals and the contractes.cat URL. Use get_company for details.",
      inputSchema: z.object({
        query: z.string().min(2).describe("Company name or NIF, e.g. 'Ferrovial' or 'A28019206'"),
        page: pageField,
      }),
      annotations: READ_ONLY,
    },
    async ({ query, page }) => {
      const offset = (page - 1) * MAX_PAGE_SIZE;
      const [rows, total] = await Promise.all([
        fetchCompanies(offset, MAX_PAGE_SIZE, query),
        fetchCompaniesCount(query),
      ]);
      return json({
        total_matches: total,
        page,
        results: rows.map((r) => ({
          name: cleanEntityName(r.denominacio_adjudicatari),
          nif: r.identificacio_adjudicatari,
          contracts: num(r.num_contracts),
          total_awarded_eur_with_vat: num(r.total),
          url: companyUrl(r.identificacio_adjudicatari, r.denominacio_adjudicatari),
        })),
      });
    }
  );

  server.registerTool(
    "get_company",
    {
      title: "Company profile",
      description:
        "Profile of a contract-winning company by NIF: public contracts won (totals, by year, top public bodies, latest contracts), current owners and administrators from BORME, and its business group if any.",
      inputSchema: z.object({
        nif: z.string().min(3).describe("Company tax ID (NIF/CIF), e.g. 'B64958838'"),
        name: z
          .string()
          .optional()
          .describe("Company name; only needed for masked or ambiguous IDs as returned by search_companies"),
      }),
      annotations: READ_ONLY,
    },
    async ({ nif, name }) => {
      const id = nif.trim().toUpperCase();
      const [{ company, yearly }, topBodies, latest, adminHistory, group] = await Promise.all([
        fetchCompanyDetail(id, name),
        fetchCompanyTopOrgans(id, name, 5),
        fetchCompanyContracts(id, name, 0, 10),
        loadAdminHistory(id),
        loadCompanyGroupByNif(id).catch(() => null),
      ]);
      if (!company) return notFound(`No public contracts found for NIF ${id}. Try search_companies.`);
      const companyName = cleanEntityName(company.denominacio_adjudicatari);
      const controllers = currentControllers(
        (adminHistory?.spans ?? []).map((span) => ({
          person_name: span.person_name,
          date_end: span.date_end,
          control: classifyControlRole(span.relation_type, span.role_title_code),
        }))
      );
      const people = (list: typeof controllers.owners) =>
        list.slice(0, 15).map((p) => ({
          // Corporate owners ("FUTBOL CLUB BARCELONA") keep their order; people are surname-first.
          name: isEntityName(p.personName) ? cleanEntityName(p.personName) : formatPersonDisplayName(p.personName),
          is_organisation: isEntityName(p.personName),
          borme_name: p.personName,
          url: personUrl(p.personName),
        }));
      return json({
        name: companyName,
        nif: id,
        url: companyUrl(id, company.denominacio_adjudicatari),
        contracts: num(company.num_contracts),
        total_awarded_eur_with_vat: num(company.total),
        by_year: yearly.map((y) => ({
          year: Number(y.year),
          contracts: num(y.num_contracts),
          eur_with_vat: num(y.total),
        })),
        top_public_bodies: topBodies.map((o) => ({
          name: o.nom_organ,
          contracts: num(o.num_contracts),
          eur_with_vat: num(o.total),
          url: organUrl(o.nom_organ),
        })),
        latest_contracts: latest.map(compactContract),
        borme: adminHistory
          ? {
              current_owners: people(controllers.owners),
              current_administrators: people(controllers.admins),
            }
          : null,
        business_group: group
          ? {
              root_company: group.rootName,
              companies: group.size,
              contract_winners: group.numContractors,
              group_contracts: group.numContracts,
              group_total_eur_with_vat: num(group.totalAmount),
              url: url(`/grups/${group.groupId}`),
            }
          : null,
      });
    }
  );

  server.registerTool(
    "search_people",
    {
      title: "Search people",
      description:
        "Search the public record of business owners and company administrators published in BORME (the official Spanish companies register, Boletín Oficial del Registro Mercantil), by name. Accent- and case-insensitive, any name order. Returns only the person's name as published, how many companies they own or administer and how many of those won public contracts in Catalonia. It never returns addresses, ID numbers, contact details or any other personal data, and only covers people acting in a business role. Read-only.",
      inputSchema: z.object({
        query: z.string().min(3).describe("Person name, e.g. 'Joan Laporta'"),
        page: pageField,
      }),
      annotations: READ_ONLY,
    },
    async ({ query, page }) => {
      const { data, total } = await searchPersonsWithTotal(query, (page - 1) * MAX_PAGE_SIZE, MAX_PAGE_SIZE);
      return json({
        total_matches: total,
        page,
        results: data.map((p) => ({
          name: formatPersonDisplayName(p.person_name),
          borme_name: p.person_name,
          companies_owned_or_administered: p.num_control_companies,
          of_which_won_public_contracts: p.num_control_companies_with_nif,
          currently_controls: p.active_control_companies,
          url: personUrl(p.person_name),
        })),
      });
    }
  );

  server.registerTool(
    "get_person",
    {
      title: "Person: companies and public contracts",
      description:
        "For a person named in BORME (the official Spanish companies register) as owner or administrator of companies: lists those companies with the periods in which the person was in charge, and the public contracts those companies won in Catalonia during those periods. Includes a plain-language answer, including explicit 'no contracts' cases. Uses only public registry and public procurement records; it never returns addresses, ID numbers, contact details or any other personal data, and only covers the person's business role. Read-only.",
      inputSchema: z.object({
        name: z.string().min(3).describe("Full name, BORME order ('LAPORTA ESTRUCH JOAN') or natural order ('Joan Laporta Estruch')"),
      }),
      annotations: READ_ONLY,
    },
    async ({ name }) => {
      const profile = await loadPersonProfile(name.trim());
      if (!profile) return notFound(`No person named "${name}" in BORME. Try search_people with part of the name.`);
      const targets = getPersonControlTargets(profile);
      const [summary, latest] = targets.nifs.length
        ? await Promise.all([
            fetchContractsByAwardeesSummary({ nifs: targets.nifs, nifDateWindows: targets.windows }),
            fetchContractsByAwardees({ nifs: targets.nifs, nifDateWindows: targets.windows, page: 1, pageSize: 15 }),
          ])
        : [{ total: 0, totalAmount: 0 }, [] as Contract[]];
      const displayName = formatPersonDisplayName(profile.person_name);
      const answer = buildPersonAnswer({
        displayName,
        numControlCompanies: profile.num_control_companies,
        numControlCompaniesWithContracts: profile.num_control_companies_with_nif,
        numContracts: summary.total,
        numContractsLabel: formatNumber(summary.total),
        amountLabel: formatCompactEuros(summary.totalAmount),
      });
      const caveats: string[] = [];
      if (profile.is_professional_admin)
        caveats.push("Appears in very many companies: likely a professional administrator or several people with the same name.");
      if (profile.ambiguous_name) caveats.push("Short name: this profile may merge several people with the same name.");
      if (targets.truncated) caveats.push("Many companies: contract totals consider the most recent control periods only.");
      return json({
        name: displayName,
        borme_name: profile.person_name,
        url: personUrl(profile.person_name),
        answer_ca: answer,
        contracts_while_in_charge: summary.total,
        amount_eur_without_vat: num(summary.totalAmount),
        caveats,
        companies_owned_or_administered: profile.companies
          .filter((c) => c.control)
          .slice(0, 40)
          .map((c) => {
            const companyName = c.company_name_matched || c.company_name_borme;
            return {
              name: cleanEntityName(companyName),
              nif: c.nif,
              won_public_contracts: Boolean(c.nif),
              currently_in_charge: c.control_active,
              periods: c.control_periods.map((p) => ({ from: isoDate(p.start), to: isoDate(p.end) })),
              url: c.nif ? companyUrl(c.nif, companyName) : null,
            };
          }),
        latest_contracts_while_in_charge: latest.map(compactContract),
      });
    }
  );

  server.registerTool(
    "search_contracts",
    {
      title: "Search contracts",
      description:
        "Search individual public contracts in Catalonia by text and filters (awardee NIF, public body, year, dates, amount, type). Amounts exclude VAT. Sorted by date (newest first) unless sort says otherwise.",
      inputSchema: z.object({
        text: z.string().optional().describe("Words in the contract title or description, e.g. 'neteja escoles'"),
        awardee_nif: z.string().optional().describe("Winning company NIF"),
        awardee_name: z.string().optional().describe("Winning company name (partial)"),
        public_body: z.string().optional().describe("Exact contracting body name, e.g. 'Ajuntament de Girona' (see search_public_bodies)"),
        year: z.number().int().min(2000).max(2100).optional(),
        date_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
        date_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("YYYY-MM-DD"),
        min_amount_eur: z.number().min(0).optional(),
        max_amount_eur: z.number().min(0).optional(),
        sort: z.enum(["date-desc", "date-asc", "amount-desc", "amount-asc"]).default("date-desc"),
        page: pageField,
      }),
      annotations: READ_ONLY,
    },
    async (args) => {
      const filters = {
        search: args.text || undefined,
        nif: args.awardee_nif?.trim().toUpperCase() || undefined,
        awardee_name: args.awardee_name || undefined,
        nom_organ: args.public_body || undefined,
        year: args.year ? String(args.year) : undefined,
        dateFrom: args.date_from,
        dateTo: args.date_to,
        amountMin: args.min_amount_eur !== undefined ? String(args.min_amount_eur) : undefined,
        amountMax: args.max_amount_eur !== undefined ? String(args.max_amount_eur) : undefined,
        page: args.page,
        pageSize: MAX_PAGE_SIZE,
        orderBy: args.sort.startsWith("amount") ? "import_adjudicacio_sense::number" : undefined,
        orderDir: args.sort.endsWith("asc") ? ("ASC" as const) : ("DESC" as const),
      };
      const [rows, total] = await Promise.all([fetchContracts(filters), fetchContractsCount(filters)]);
      const qs = new URLSearchParams();
      if (filters.search) qs.set("search", filters.search);
      if (filters.nif) qs.set("nif", filters.nif);
      if (filters.nom_organ) qs.set("nom_organ", filters.nom_organ);
      if (filters.year) qs.set("year", filters.year);
      return json({
        total_matches: total,
        page: args.page,
        url: url(`/contractes${qs.size ? `?${qs}` : ""}`),
        results: rows.map(compactContract),
      });
    }
  );

  server.registerTool(
    "search_public_bodies",
    {
      title: "Search public bodies",
      description:
        "Find contracting bodies in Catalonia (town councils, Generalitat departments, hospitals, universities…) by name, with total contracts awarded. Returns the exact name to use in other tools.",
      inputSchema: z.object({
        query: z.string().min(2).describe("e.g. 'Ajuntament de Girona', 'Institut Català de la Salut'"),
        page: pageField,
      }),
      annotations: READ_ONLY,
    },
    async ({ query, page }) => {
      const rows = await fetchOrgans((page - 1) * MAX_PAGE_SIZE, MAX_PAGE_SIZE, query);
      return json({
        page,
        results: rows.map((o) => ({
          name: o.nom_organ,
          contracts: num(o.num_contracts),
          total_awarded_eur_with_vat: num(o.total),
          url: organUrl(o.nom_organ),
        })),
      });
    }
  );

  server.registerTool(
    "get_public_body_top_companies",
    {
      title: "Top companies of a public body",
      description:
        "Companies that won the most (by amount) from one contracting body, optionally since a given year.",
      inputSchema: z.object({
        public_body: z.string().min(3).describe("Exact name as returned by search_public_bodies"),
        since_year: z.number().int().min(2000).max(2100).optional(),
        limit: z.number().int().min(1).max(50).default(10),
      }),
      annotations: READ_ONLY,
    },
    async ({ public_body, since_year, limit }) => {
      const rows = await fetchOrganTopCompanies(public_body, limit, since_year);
      if (rows.length === 0)
        return notFound(`No contracts for "${public_body}". Use search_public_bodies to get the exact name.`);
      return json({
        public_body,
        url: organUrl(public_body),
        since_year: since_year ?? null,
        results: rows.map((r) => ({
          name: cleanEntityName(r.denominacio_adjudicatari),
          nif: r.identificacio_adjudicatari,
          contracts: num(r.num_contracts),
          eur_with_vat: num(r.total),
          url: companyUrl(r.identificacio_adjudicatari, r.denominacio_adjudicatari),
        })),
      });
    }
  );
}
