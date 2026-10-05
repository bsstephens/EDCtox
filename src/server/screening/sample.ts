import { governingPurpose } from "./deterministic";
import type { ScreeningPurposeName } from "./reasons";

export type QueueCandidate = {
  sourceId: string;
  title: string;
  year: number | null;
  purposes: readonly ScreeningPurposeName[];
  windows: readonly string[];
  retracted: boolean;
  publicationStatus: string | null;
  machineDecision: string | null;
};

const PURPOSE_RANK: Record<ScreeningPurposeName, number> = {
  SYSTEMATIC_REVIEWS: 0,
  HUMAN_REPRODUCTIVE: 1,
  CONTRADICTORY_OR_NULL: 2,
};

function purposeRank(purpose: ScreeningPurposeName | null): number {
  if (!purpose) return 9;
  return PURPOSE_RANK[purpose] ?? 9;
}

export function sortScreeningQueue<T extends QueueCandidate>(rows: readonly T[]): T[] {
  return [...rows].sort((left, right) => {
    const leftPurpose = governingPurpose(left.purposes);
    const rightPurpose = governingPurpose(right.purposes);
    const purposeDelta = purposeRank(leftPurpose) - purposeRank(rightPurpose);
    if (purposeDelta !== 0) return purposeDelta;
    const windowDelta = (left.windows.includes("relevance") ? 0 : 1) - (right.windows.includes("relevance") ? 0 : 1);
    if (windowDelta !== 0) return windowDelta;
    const yearDelta = (right.year ?? 0) - (left.year ?? 0);
    if (yearDelta !== 0) return yearDelta;
    return left.title.localeCompare(right.title);
  });
}

function headAndTail<T>(rows: readonly T[], head: number, tail: number): T[] {
  if (rows.length <= head + tail) return [...rows];
  const chosen = rows.slice(0, head);
  for (const row of rows.slice(-tail)) {
    if (!chosen.includes(row)) chosen.push(row);
  }
  return chosen;
}

export function selectSuggestionSample<T extends QueueCandidate>(rows: readonly T[], limit: number): T[] {
  const pending = sortScreeningQueue(rows).filter(
    (row) => row.publicationStatus === "SCREENING_PENDING" && !row.retracted,
  );
  if (limit !== 20) return pending.slice(0, limit);
  const reviews = pending.filter((row) => governingPurpose(row.purposes) === "SYSTEMATIC_REVIEWS");
  const human = pending.filter((row) => governingPurpose(row.purposes) === "HUMAN_REPRODUCTIVE");
  const contradictory = pending.filter((row) => governingPurpose(row.purposes) === "CONTRADICTORY_OR_NULL");
  return [...headAndTail(reviews, 3, 2), ...headAndTail(human, 5, 3), ...headAndTail(contradictory, 4, 3)];
}
