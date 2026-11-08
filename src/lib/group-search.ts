import { unstable_cache } from "next/cache";
import { loadContractingGroups, type GroupSearchEntry } from "@/lib/borme";
import { displayCompanyName } from "@/lib/company-names";
import { parseSearchQuery, rankingKey } from "@/lib/search-query";

export interface GroupSearchResult {
  groupId: number;
  name: string;
  size: number;
  totalAmount: number;
  /** Member company that matched, when the match was not on the group's own name. */
  via: string | null;
}

// The group list changes only when the BORME pipeline rebuilds it.
export const getContractingGroups = unstable_cache(loadContractingGroups, ["contracting-groups-v1"], { revalidate: 86400 });

function bestMatch(group: GroupSearchEntry, query: ReturnType<typeof parseSearchQuery>) {
  if (query.nif) {
    const member = group.members.find((m) => m.nif === query.nif);
    return member ? { key: 100, via: member.name === group.rootName ? null : member.name } : null;
  }
  const own = rankingKey(group.rootName, query, group.totalAmount);
  let best = own > 0 ? { key: own + 1, via: null as string | null } : null;
  for (const member of group.members) {
    if (member.name === group.rootName) continue;
    const key = rankingKey(member.name, query, group.totalAmount);
    if (key > 0 && (!best || key > best.key)) best = { key, via: member.name };
  }
  return best;
}

/**
 * Groups whose name, or a member company's name or NIF, matches the query.
 * Matching on the group's own name ranks above matching through a member.
 */
export async function searchGroups(input: string, limit = 5): Promise<GroupSearchResult[]> {
  const query = parseSearchQuery(input);
  if (!query.raw || query.raw.length < 2) return [];
  const groups = await getContractingGroups();
  return groups
    .map((group) => ({ group, match: bestMatch(group, query) }))
    .filter((entry): entry is { group: GroupSearchEntry; match: { key: number; via: string | null } } => entry.match !== null)
    .sort((a, b) => b.match.key - a.match.key || b.group.totalAmount - a.group.totalAmount)
    .slice(0, limit)
    .map(({ group, match }) => ({
      groupId: group.groupId,
      name: displayCompanyName(group.rootName, false),
      size: group.size,
      totalAmount: group.totalAmount,
      via: match.via ? displayCompanyName(match.via, false) : null,
    }));
}
