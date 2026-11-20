import { toSummarizable } from "~/server/atlas/queries";
import { db } from "~/server/db";
import {
  summarizeDomain,
  type SummarizableAssessment,
} from "~/server/scoring/summarize";

/**
 * The coverage map: every compound against every biological domain, one cell each.
 *
 * It answers "what has been assessed", never "what is dangerous". A cell's position is
 * (compound, domain) and carries no other meaning, so there is no distance to misread. The
 * headline number in a scored cell comes from summarizeDomain, the same function the index
 * table uses, so the two views can never disagree.
 *
 * Not to be confused with src/server/coverage/, which is how far extracted claims have been
 * mapped onto the ontology for one compound.
 */

export type CoverageCellState =
  /** A headline number exists, other than zero. */
  | "SCORED"
  /** The headline is zero: assessed and no meaningful effect demonstrated. A result, not a blank. */
  | "NO_EFFECT"
  /** Assessments are stored and no number was justified, or activity is physiological. */
  | "UNSCORED"
  /** Every stored row is research-only or grouping-only, so none enters a headline. */
  | "OUTSIDE_HEADLINE"
  /** Claims have been extracted and mapped here, but nobody has assessed them yet. */
  | "CLAIMS_ONLY"
  /** Nothing of any kind. Nobody has looked. */
  | "EMPTY";

export type CoverageCell = {
  shortLabel: string;
  state: CoverageCellState;
  score: number | null;
  humanRelevance: string | null;
  confidence: string | null;
  /** True only when at least one assessment has left SEED_HYPOTHESIS. */
  curated: boolean;
  assessmentCount: number;
  findingCount: number;
  claimCount: number;
  /** The cell's whole meaning in one sentence, used as its accessible name and hover text. */
  label: string;
};

export type CoverageColumn = {
  code: string;
  shortLabel: string;
  name: string;
  track: string;
  contributesToProfile: boolean;
};

export type CoverageRow = {
  slug: string;
  displayName: string;
  compoundType: string;
  primaryCategory: string;
  recordKind: string;
  cells: Record<string, CoverageCell>;
  /** Profile domains holding at least one assessment. A count of work done, never a score. */
  assessedDomains: number;
  assessmentCount: number;
  claimCount: number;
  unmappedClaimCount: number;
  regulatoryCount: number;
  strongestAbsoluteScore: number | null;
};

export type CoverageTotals = {
  compounds: number;
  profileColumns: number;
  contextualColumns: number;
  profileCells: number;
  assessedCells: number;
  scoredCells: number;
  noEffectCells: number;
  unscoredCells: number;
  outsideHeadlineCells: number;
  claimsOnlyCells: number;
  emptyCells: number;
  assessments: number;
  curatedAssessments: number;
  compoundsWithAnyAssessment: number;
  unmappedClaims: number;
};

export type CoverageMap = {
  columns: CoverageColumn[];
  rows: CoverageRow[];
  totals: CoverageTotals;
};

/**
 * The whole point of the map in one function. A naive heatmap has two states, filled and grey,
 * and so tells a reader that "assessed, no effect" and "nobody looked" are the same thing. The
 * schema distinguishes them, so this does too.
 */
export function cellStateFor(input: {
  score: number | null;
  assessmentCount: number;
  unscoredReason: string | null;
  claimCount: number;
}): CoverageCellState {
  if (input.score !== null) return input.score === 0 ? "NO_EFFECT" : "SCORED";
  if (input.assessmentCount > 0) {
    return input.unscoredReason === "OUTSIDE_HEADLINE"
      ? "OUTSIDE_HEADLINE"
      : "UNSCORED";
  }
  if (input.claimCount > 0) return "CLAIMS_ONLY";
  return "EMPTY";
}

function cellLabel(
  compound: string,
  column: CoverageColumn,
  state: CoverageCellState,
  score: number | null,
  assessmentCount: number,
  claimCount: number,
): string {
  const where = `${compound}, ${column.name}`;
  switch (state) {
    case "SCORED":
      return `${where}: headline ${score! > 0 ? `+${score}` : score}, from ${assessmentCount} assessment${assessmentCount === 1 ? "" : "s"}.`;
    case "NO_EFFECT":
      return `${where}: assessed, no meaningful effect demonstrated. That is a result, not a blank.`;
    case "UNSCORED":
      return `${where}: assessed, deliberately no number. ${assessmentCount} assessment${assessmentCount === 1 ? "" : "s"} stored.`;
    case "OUTSIDE_HEADLINE":
      return `${where}: assessed on research-only mechanisms, which never enter a headline.`;
    case "CLAIMS_ONLY":
      return `${where}: ${claimCount} extracted claim${claimCount === 1 ? "" : "s"} mapped here, not yet assessed.`;
    default:
      return `${where}: not assessed. Nobody has looked. That is not evidence of no effect.`;
  }
}

export async function loadCoverageMap(): Promise<CoverageMap> {
  const [domains, compounds] = await Promise.all([
    db.biologicalDomain.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        code: true,
        shortLabel: true,
        name: true,
        track: true,
        contributesToProfile: true,
      },
    }),
    db.compound.findMany({
      orderBy: { displayName: "asc" },
      select: {
        slug: true,
        displayName: true,
        compoundType: true,
        primaryCategory: true,
        recordKind: true,
        regulatoryAssessments: { select: { id: true } },
        mechanisticClaims: {
          select: {
            mechanism: { select: { domain: { select: { shortLabel: true } } } },
          },
        },
        mechanismAssessments: {
          select: {
            effectScore: true,
            effectDirection: true,
            activityMagnitude: true,
            evidenceConfidence: true,
            humanRelevance: true,
            conflictingEvidence: true,
            quantitativeScoreSupported: true,
            curationStatus: true,
            causalPathway: { select: { code: true } },
            mechanism: {
              select: {
                code: true,
                name: true,
                aggregationGroup: true,
                scorePolicy: true,
                domain: { select: { shortLabel: true } },
              },
            },
            findings: {
              select: {
                effectDirection: true,
                source: { select: { countsAsScientificEvidence: true } },
              },
            },
          },
        },
      },
    }),
  ]);

  const columns: CoverageColumn[] = domains;
  const totals: CoverageTotals = {
    compounds: compounds.length,
    profileColumns: columns.filter((column) => column.contributesToProfile)
      .length,
    contextualColumns: columns.filter((column) => !column.contributesToProfile)
      .length,
    profileCells: 0,
    assessedCells: 0,
    scoredCells: 0,
    noEffectCells: 0,
    unscoredCells: 0,
    outsideHeadlineCells: 0,
    claimsOnlyCells: 0,
    emptyCells: 0,
    assessments: 0,
    curatedAssessments: 0,
    compoundsWithAnyAssessment: 0,
    unmappedClaims: 0,
  };

  const rows: CoverageRow[] = compounds.map((compound) => {
    const grouped = new Map<
      string,
      { rows: SummarizableAssessment[]; findings: number; curated: boolean }
    >();
    for (const assessment of compound.mechanismAssessments) {
      const key = assessment.mechanism.domain.shortLabel;
      const bucket = grouped.get(key) ?? {
        rows: [],
        findings: 0,
        curated: false,
      };
      bucket.rows.push(toSummarizable(assessment));
      bucket.findings += assessment.findings.filter(
        (finding) => finding.source.countsAsScientificEvidence,
      ).length;
      if (assessment.curationStatus !== "SEED_HYPOTHESIS")
        bucket.curated = true;
      grouped.set(key, bucket);
    }

    const claimsByDomain = new Map<string, number>();
    let unmappedClaimCount = 0;
    for (const claim of compound.mechanisticClaims) {
      const key = claim.mechanism?.domain.shortLabel;
      if (!key) {
        unmappedClaimCount += 1;
        continue;
      }
      claimsByDomain.set(key, (claimsByDomain.get(key) ?? 0) + 1);
    }

    const cells: Record<string, CoverageCell> = {};
    let assessedDomains = 0;
    let strongestAbsoluteScore: number | null = null;

    for (const column of columns) {
      const bucket = grouped.get(column.shortLabel);
      const claimCount = claimsByDomain.get(column.shortLabel) ?? 0;
      const summary = summarizeDomain({
        domainCode: column.code,
        shortLabel: column.shortLabel,
        contributesToProfile: column.contributesToProfile,
        assessments: bucket?.rows ?? [],
      });
      const assessmentCount = bucket?.rows.length ?? 0;
      const score = summary.maximumEvidenceSupportedEffect;

      const state = cellStateFor({
        score,
        assessmentCount,
        unscoredReason: summary.unscoredReason,
        claimCount,
      });

      if (assessmentCount > 0 && column.contributesToProfile)
        assessedDomains += 1;
      if (score !== null && column.contributesToProfile) {
        const magnitude = Math.abs(score);
        if (
          strongestAbsoluteScore === null ||
          magnitude > strongestAbsoluteScore
        ) {
          strongestAbsoluteScore = magnitude;
        }
      }

      if (column.contributesToProfile) {
        totals.profileCells += 1;
        if (state === "SCORED") totals.scoredCells += 1;
        if (state === "NO_EFFECT") totals.noEffectCells += 1;
        if (state === "UNSCORED") totals.unscoredCells += 1;
        if (state === "OUTSIDE_HEADLINE") totals.outsideHeadlineCells += 1;
        if (state === "CLAIMS_ONLY") totals.claimsOnlyCells += 1;
        if (state === "EMPTY") totals.emptyCells += 1;
        if (assessmentCount > 0) totals.assessedCells += 1;
      }

      cells[column.shortLabel] = {
        shortLabel: column.shortLabel,
        state,
        score,
        humanRelevance: summary.humanRelevance,
        confidence: summary.confidence,
        curated: bucket?.curated ?? false,
        assessmentCount,
        findingCount: bucket?.findings ?? 0,
        claimCount,
        label: cellLabel(
          compound.displayName,
          column,
          state,
          score,
          assessmentCount,
          claimCount,
        ),
      };
    }

    totals.assessments += compound.mechanismAssessments.length;
    totals.curatedAssessments += compound.mechanismAssessments.filter(
      (assessment) => assessment.curationStatus !== "SEED_HYPOTHESIS",
    ).length;
    if (compound.mechanismAssessments.length > 0)
      totals.compoundsWithAnyAssessment += 1;
    totals.unmappedClaims += unmappedClaimCount;

    return {
      slug: compound.slug,
      displayName: compound.displayName,
      compoundType: compound.compoundType,
      primaryCategory: compound.primaryCategory,
      recordKind: compound.recordKind,
      cells,
      assessedDomains,
      assessmentCount: compound.mechanismAssessments.length,
      claimCount: compound.mechanisticClaims.length,
      unmappedClaimCount,
      regulatoryCount: compound.regulatoryAssessments.length,
      strongestAbsoluteScore,
    };
  });

  return { columns, rows, totals };
}

/**
 * Row arrangements. Every one of these orders compounds by what EDCtox has done or by what a
 * compound is. None of them orders by harm, and "work" is named for the work rather than for
 * the chemical so that the top of the list cannot be read as a ranking of danger.
 */
export const ARRANGEMENTS = [
  { value: "name", label: "Name" },
  { value: "work", label: "Work done" },
  { value: "category", label: "Category" },
  { value: "salience", label: "Regulatory identifications" },
  { value: "score", label: "Strongest magnitude" },
] as const;

export type Arrangement = (typeof ARRANGEMENTS)[number]["value"];

export const COLOURINGS = [
  { value: "fill", label: "Whether it is assessed" },
  { value: "score", label: "Headline score" },
  { value: "human", label: "Human relevance" },
  { value: "confidence", label: "Confidence" },
  { value: "curation", label: "Seed or curated" },
  { value: "evidence", label: "Findings behind it" },
] as const;

export type Colouring = (typeof COLOURINGS)[number]["value"];

export function parseArrangement(value: string | undefined): Arrangement {
  return ARRANGEMENTS.some((item) => item.value === value)
    ? (value as Arrangement)
    : "name";
}

export function parseColouring(value: string | undefined): Colouring {
  return COLOURINGS.some((item) => item.value === value)
    ? (value as Colouring)
    : "fill";
}

/** Stable: every arrangement falls back to the compound name, so the order is never arbitrary. */
export function arrangeRows(
  rows: readonly CoverageRow[],
  arrangement: Arrangement,
): CoverageRow[] {
  const byName = (a: CoverageRow, b: CoverageRow) =>
    a.displayName.localeCompare(b.displayName);
  const sorted = [...rows];
  switch (arrangement) {
    case "work":
      return sorted.sort(
        (a, b) =>
          b.assessedDomains - a.assessedDomains ||
          b.assessmentCount - a.assessmentCount ||
          byName(a, b),
      );
    case "category":
      return sorted.sort(
        (a, b) => a.compoundType.localeCompare(b.compoundType) || byName(a, b),
      );
    case "salience":
      return sorted.sort(
        (a, b) =>
          b.regulatoryCount - a.regulatoryCount ||
          b.assessedDomains - a.assessedDomains ||
          byName(a, b),
      );
    case "score":
      return sorted.sort(
        (a, b) =>
          (b.strongestAbsoluteScore ?? -1) - (a.strongestAbsoluteScore ?? -1) ||
          byName(a, b),
      );
    default:
      return sorted.sort(byName);
  }
}
