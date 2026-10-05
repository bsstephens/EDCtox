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
