import { CLAIM_PILOT_PMIDS } from "./constants";

export type PilotRow = {
  pmid: string | null;
  retracted: boolean;
  publicationStatus: string | null;
};

export function selectClaimPilot<T extends PilotRow>(rows: readonly T[], limit: number): T[] {
  const byPmid = new Map<string, T>();
  for (const row of rows) {
    if (row.pmid) byPmid.set(row.pmid, row);
  }
  const chosen: T[] = [];
  for (const pmid of CLAIM_PILOT_PMIDS) {
    if (chosen.length >= limit) break;
    const row = byPmid.get(pmid);
    if (!row || row.retracted) continue;
    if (row.publicationStatus !== "SCREENING_PENDING") continue;
    chosen.push(row);
  }
  return chosen;
}


export type CentralityRow = {
  pmid: string | null;
  year: number | null;
  profiles: ReadonlyArray<{ compoundsStudied: readonly string[] }>;
};

/**
 * Orders a screened cohort by how central the compound is to each paper, from the profiler's
 * own reading of it.
 *
 * The screener includes a paper when it is relevant to this compound and domain, which is the
 * right screening question but a different one from whether the paper measures anything about
 * the compound. Much of the BPA reproductive cohort tests BPA as the fifth of eight agents in
 * a panel, or as a comparator in an assay built for oestradiol. An abstract like that yields a
 * claim about a bystander: true, unmappable, and of little use to a curator. Reading the
 * oldest papers first made that the whole of the first sample, because the multi-compound
 * screening assays are the older literature.
 *
 * Nothing is dropped on this basis. A bystander finding is still a finding, and a reported
 * absence of effect in a panel is worth having. The cohort is only ordered, so that reading the
 * first n papers reads the n most informative ones.
 */
export function orderByCompoundCentrality<T extends CentralityRow>(rows: readonly T[], matches: (name: string) => boolean): T[] {
  const rank = (row: T) => {
    const lists = row.profiles.map((profile) => profile.compoundsStudied).filter((list) => list.length > 0);
    if (lists.length === 0) return { studied: Number.MAX_SAFE_INTEGER, first: false };
    return {
      studied: Math.min(...lists.map((list) => list.length)),
      first: lists.some((list) => matches(list[0] ?? "")),
    };
  };
  return [...rows].sort((a, b) => {
    const left = rank(a);
    const right = rank(b);
    if (left.first !== right.first) return left.first ? -1 : 1;
    if (left.studied !== right.studied) return left.studied - right.studied;
    // Newest first within a tier: the recent literature states mechanisms the older screening
    // assays do not, and a tie has to break somewhere stable.
    if ((a.year ?? 0) !== (b.year ?? 0)) return (b.year ?? 0) - (a.year ?? 0);
    return (a.pmid ?? "").localeCompare(b.pmid ?? "");
  });
}
