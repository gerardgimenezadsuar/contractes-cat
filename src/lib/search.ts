import type { CompanyAggregation, OrganAggregation } from "@/lib/types";

export type SearchMode = "tots" | "empresa" | "organisme" | "persona";

export interface PersonSearchResult {
  person_name: string;
  num_companies: number;
  num_companies_with_nif: number;
  active_spans: number;
  total?: number;
}

export interface UnifiedSearchSections {
  empreses: CompanyAggregation[];
  organismes: OrganAggregation[];
  persones: PersonSearchResult[];
}

export interface UnifiedSearchOptions {
  mixedSectionLimit?: number;
  singleModeLimit?: number;
}

interface ApiDataResponse<T> {
  data?: T[];
}

interface PersonContractsSummaryResponse {
  totalAmount?: number;
}

const DEFAULT_MIXED_SECTION_LIMIT = 5;
const DEFAULT_SINGLE_MODE_LIMIT = 8;

const parseJsonOrThrow = async <T>(res: Response): Promise<ApiDataResponse<T>> => {
  if (!res.ok) {
    throw new Error(`Search request failed with status ${res.status}`);
  }
  return res.json() as Promise<ApiDataResponse<T>>;
};

const fetchPersonTotalAmount = async (personName: string, signal?: AbortSignal): Promise<number> => {
  try {
    const response = await fetch(
      `/api/persones/${encodeURIComponent(personName)}/contractes?page=1&sort=amount-desc`,
      { signal }
    );
    if (!response.ok) return 0;
    const json = (await response.json()) as PersonContractsSummaryResponse;
    return Number(json.totalAmount || 0);
  } catch (errorValue) {
    if (errorValue instanceof DOMException && errorValue.name === "AbortError") {
      throw errorValue;
    }
    return 0;
  }
};

export const minCharsForMode = (mode: SearchMode): number =>
  mode === "tots" || mode === "persona" ? 3 : 2;

export const isAbortError = (errorValue: unknown): boolean =>
  errorValue instanceof DOMException && errorValue.name === "AbortError";

export async function fetchUnifiedSearch(
  query: string,
  mode: SearchMode,
  signal?: AbortSignal,
  options: UnifiedSearchOptions = {}
): Promise<UnifiedSearchSections> {
  const mixedSectionLimit = options.mixedSectionLimit ?? DEFAULT_MIXED_SECTION_LIMIT;
  const singleModeLimit = options.singleModeLimit ?? DEFAULT_SINGLE_MODE_LIMIT;
  const encodedQuery = encodeURIComponent(query);

  if (mode === "tots") {
    const [empRes, orgRes, perRes] = await Promise.all([
      fetch(`/api/empreses?search=${encodedQuery}&page=1&includeTotal=0`, { signal }),
      fetch(`/api/organismes?search=${encodedQuery}&page=1&limit=${mixedSectionLimit}&includeTotal=0&includeCurrentYear=0`, { signal }),
      fetch(`/api/persones?search=${encodedQuery}&page=1&includeTotal=0`, { signal }),
    ]);
    const [empJson, orgJson, perJson] = await Promise.all([
      parseJsonOrThrow<CompanyAggregation>(empRes),
      parseJsonOrThrow<OrganAggregation>(orgRes),
      parseJsonOrThrow<PersonSearchResult>(perRes),
    ]);

    const basePersones = (perJson.data || []).slice(0, mixedSectionLimit);
    const personesWithTotals = await Promise.all(
      basePersones.map(async (person) => ({
        ...person,
        total: await fetchPersonTotalAmount(person.person_name, signal),
      }))
    );
    const orderedPersones = personesWithTotals.sort(
      (a, b) => (b.total || 0) - (a.total || 0)
    );

    return {
      empreses: (empJson.data || []).slice(0, mixedSectionLimit),
      organismes: (orgJson.data || []).slice(0, mixedSectionLimit),
      persones: orderedPersones,
    };
  }

  const endpoint =
    mode === "empresa"
      ? `/api/empreses?search=${encodedQuery}&page=1&includeTotal=0`
      : mode === "organisme"
        ? `/api/organismes?search=${encodedQuery}&page=1&limit=${singleModeLimit}&includeTotal=0&includeCurrentYear=0`
        : `/api/persones?search=${encodedQuery}&page=1&includeTotal=0`;
  const res = await fetch(endpoint, { signal });
  const json =
    mode === "empresa"
      ? await parseJsonOrThrow<CompanyAggregation>(res)
      : mode === "organisme"
        ? await parseJsonOrThrow<OrganAggregation>(res)
        : await parseJsonOrThrow<PersonSearchResult>(res);
  const data = (json.data || []).slice(0, singleModeLimit);

  if (mode === "empresa") {
    return { empreses: data as CompanyAggregation[], organismes: [], persones: [] };
  }
  if (mode === "organisme") {
    return { empreses: [], organismes: data as OrganAggregation[], persones: [] };
  }
  return { empreses: [], organismes: [], persones: data as PersonSearchResult[] };
}
