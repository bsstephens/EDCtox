/**
 * Domain headlines are the strongest independent mechanistic cluster.
 * They are not sums. Human relevance is never multiplied into the effect.
 *
 * A causal chain such as electron-transport impairment → ROS → impaired
 * insulin signalling → insulin resistance can appear in more than one
 * domain. Each domain keeps its own headline. Domains are not added.
 */

export const CONFIDENCE_RANK = {
  VERY_LOW: 0,
  LOW: 1,
  MODERATE: 2,
  HIGH: 3,
  VERY_HIGH: 4,
} as const;

export const HUMAN_RANK = {
  H0: 0,
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 4,
} as const;

export type Confidence = keyof typeof CONFIDENCE_RANK;
export type HumanRelevance = keyof typeof HUMAN_RANK;

const CONFIDENCE_ORDER: Confidence[] = [
  "VERY_LOW",
  "LOW",
  "MODERATE",
  "HIGH",
  "VERY_HIGH",
];

export type ScorePolicy = "SCORABLE" | "RESEARCH_ONLY" | "GROUPING_ONLY";

export type SummarizableAssessment = {
  mechanismCode: string;
  mechanismName: string;
  aggregationGroup: string;
  scorePolicy: ScorePolicy;
  effectScore: number | null;
  effectDirection: string;
  activityMagnitude: string;
  evidenceConfidence: Confidence;
  humanRelevance: HumanRelevance;
  conflictingEvidence: boolean;
  quantitativeScoreSupported: boolean;
  causalPathwayCode: string | null;
  curationStatus?: string;
  /** Linked findings that count as scientific evidence, not structural placeholders. */
  supportingFindingCount: number;
  contradictoryFindingCount: number;
};

export type ClusterTrace = {
  aggregationGroup: string;
  selectedMechanismCode: string;
  selectedMechanismName: string;
  effectScore: number | null;
  effectDirection: string;
  evidenceConfidence: Confidence;
  humanRelevance: HumanRelevance;
  cappedMechanismCodes: string[];
  reason: string;
};

export type DomainSummary = {
  domainCode: string;
  shortLabel: string;
  contributesToProfile: boolean;
  dominantDirection: string;
  maximumEvidenceSupportedEffect: number | null;
  physiologicalMagnitude: string | null;
  confidence: Confidence | null;
  confidenceAdjusted: boolean;
  humanRelevance: HumanRelevance | null;
  numberOfSupportingFindings: number;
  numberOfContradictoryFindings: number;
  numberOfCappedObservations: number;
  summaryText: string;
  trace: ClusterTrace[];
};

export const SCORING_RULES = [
  "A signed score is biological direction and magnitude, from −4 (strongly protective or restorative) to +4 (strong disruption). It is not a human-risk number.",
  "Confidence (very low through very high) is stored separately. Human relevance (H0–H4) is stored separately. Neither is multiplied into the effect score.",
  "Null means no quantitative score was justified. Physiological high activity, such as melatonin at MT1/MT2, is not recorded as +4 disruption.",
  "Within an aggregation group, child mechanisms are one cluster. The cluster contributes its strongest absolute score, not the sum of its members.",
  "Across clusters in a domain, the headline is the strongest cluster, not the sum of clusters.",
  "When absolute scores tie, the cluster with higher human relevance is selected, then higher confidence. This is the only way human evidence is weighted more heavily than cellular evidence.",
  "Opposing directions are not averaged to zero. The headline keeps the larger magnitude, confidence drops one step when an opposing cluster is also present, and both sides stay in the trace.",
  "Research-only mechanisms, including reorganization energy, never enter the headline unless a later curated row changes that policy. ATP or oxygen changes are not treated as Marcus-theory evidence.",
  "The exposure-modifier domain does not contribute a profile column.",
  "Cross-domain pathway tags explain a possible causal chain. They do not collapse those domains into one total.",
  "Regulatory classifications are a separate layer and are not the scientific score.",
  "Seed hypotheses are labelled as such. They are starting assessments, not curated consensus.",
  "Activity magnitude is how strongly a pathway moves. The signed score is the protective or disruptive consequence, and it stays null when that consequence is not justified.",
  "Study quality belongs to an evidence finding. Evidence confidence belongs to the synthesized assessment. They are not the same field.",
  "Biological context (organ, tissue, cell, compartment) is stored separately so the same pathway can differ by place. Those rows are still capped inside one aggregation group.",
  "A dose metric names what a number would mean: prescribed dose, administered dose, dietary concentration, or an environmental concentration. Those metrics are not converted into each other.",
] as const;

function sign(value: number): -1 | 0 | 1 {
  if (value > 0) return 1;
  if (value < 0) return -1;
  return 0;
}

function signed(value: number): string {
  if (value > 0) return `+${value}`;
  return String(value);
}

function downgrade(confidence: Confidence): Confidence {
  const index = CONFIDENCE_RANK[confidence];
  return CONFIDENCE_ORDER[Math.max(0, index - 1)] ?? "VERY_LOW";
}

function magnitudeRank(magnitude: string): number {
  switch (magnitude) {
    case "VERY_HIGH":
      return 4;
    case "HIGH":
      return 3;
    case "MODERATE":
      return 2;
    case "LOW":
      return 1;
    default:
      return 0;
  }
}

function isNumeric(row: SummarizableAssessment): row is SummarizableAssessment & {
  effectScore: number;
} {
  return (
    row.scorePolicy === "SCORABLE" &&
    row.quantitativeScoreSupported &&
    row.effectScore !== null &&
    row.effectScore >= -4 &&
    row.effectScore <= 4
  );
}

function compareCandidates(
  a: SummarizableAssessment & { effectScore: number },
  b: SummarizableAssessment & { effectScore: number },
): number {
  const absDiff = Math.abs(b.effectScore) - Math.abs(a.effectScore);
  if (absDiff !== 0) return absDiff;
  const humanDiff = HUMAN_RANK[b.humanRelevance] - HUMAN_RANK[a.humanRelevance];
  if (humanDiff !== 0) return humanDiff;
  const confidenceDiff =
    CONFIDENCE_RANK[b.evidenceConfidence] - CONFIDENCE_RANK[a.evidenceConfidence];
  if (confidenceDiff !== 0) return confidenceDiff;
  return a.mechanismCode.localeCompare(b.mechanismCode);
}

export function summarizeDomain(input: {
  domainCode: string;
  shortLabel: string;
  contributesToProfile: boolean;
  assessments: SummarizableAssessment[];
}): DomainSummary {
  const base: DomainSummary = {
    domainCode: input.domainCode,
    shortLabel: input.shortLabel,
    contributesToProfile: input.contributesToProfile,
    dominantDirection: "UNKNOWN",
    maximumEvidenceSupportedEffect: null,
    physiologicalMagnitude: null,
    confidence: null,
    confidenceAdjusted: false,
    humanRelevance: null,
    numberOfSupportingFindings: 0,
    numberOfContradictoryFindings: 0,
    numberOfCappedObservations: 0,
    summaryText: "",
    trace: [],
  };

  if (!input.contributesToProfile) {
    base.summaryText =
      "This domain records exposure and developmental context. It does not contribute a profile score and is not added to mechanistic domains.";
    return base;
  }

  const numeric = input.assessments.filter(isNumeric);
  const ignoredResearch = input.assessments.filter(
    (row) => row.scorePolicy !== "SCORABLE" && row.effectScore !== null,
  );

  const groups = new Map<string, Array<SummarizableAssessment & { effectScore: number }>>();
  for (const row of numeric) {
    const existing = groups.get(row.aggregationGroup) ?? [];
    existing.push(row);
    groups.set(row.aggregationGroup, existing);
  }

  const clusterSelections: Array<{
    selected: SummarizableAssessment & { effectScore: number };
    capped: string[];
  }> = [];

  for (const members of groups.values()) {
    const ordered = [...members].sort(compareCandidates);
    const selected = ordered[0];
    if (!selected) continue;
    clusterSelections.push({
      selected,
      capped: ordered.slice(1).map((row) => row.mechanismCode),
    });
  }

  clusterSelections.sort((a, b) => compareCandidates(a.selected, b.selected));

  const physiological = input.assessments
    .filter(
      (row) =>
        row.scorePolicy === "SCORABLE" &&
        row.effectScore === null &&
        row.effectDirection === "PHYSIOLOGICAL",
    )
    .sort((a, b) => magnitudeRank(b.activityMagnitude) - magnitudeRank(a.activityMagnitude));

  const topPhysiological = physiological[0];
  if (topPhysiological && magnitudeRank(topPhysiological.activityMagnitude) >= 3) {
    base.physiologicalMagnitude = topPhysiological.activityMagnitude;
  }

  base.trace = clusterSelections.map(({ selected, capped }) => ({
    aggregationGroup: selected.aggregationGroup,
    selectedMechanismCode: selected.mechanismCode,
    selectedMechanismName: selected.mechanismName,
    effectScore: selected.effectScore,
    effectDirection: selected.effectDirection,
    evidenceConfidence: selected.evidenceConfidence,
    humanRelevance: selected.humanRelevance,
    cappedMechanismCodes: capped,
    reason: capped.length
      ? `Strongest absolute score in ${selected.aggregationGroup}. ${capped.join(", ")} ${capped.length === 1 ? "is" : "are"} the same cluster and ${capped.length === 1 ? "was" : "were"} not added.`
      : `Only scored mechanism in ${selected.aggregationGroup}.`,
  }));

  base.numberOfCappedObservations = base.trace.reduce(
    (sum, cluster) => sum + cluster.cappedMechanismCodes.length,
    0,
  );

  const sentences: string[] = [];

  if (ignoredResearch.length > 0) {
    sentences.push(
      `Excluded from the headline because the mechanism is not scorable: ${ignoredResearch
        .map((row) => row.mechanismCode)
        .join(", ")}. Reorganization energy is not inferred from ATP or oxygen consumption.`,
    );
  }

  const winner = clusterSelections[0];
  if (!winner) {
    if (base.physiologicalMagnitude) {
      base.dominantDirection = "PHYSIOLOGICAL";
      sentences.unshift(
        `Physiological activity is ${base.physiologicalMagnitude.toLowerCase().replaceAll("_", " ")}. That activity is not a toxicity score.`,
      );
    } else {
      sentences.unshift("No quantitative mechanistic score is stored for this domain.");
    }
    base.summaryText = sentences.join(" ");
    return base;
  }

  const selected = winner.selected;
  const opposing = clusterSelections.slice(1).filter((cluster) => {
    return sign(cluster.selected.effectScore) === -sign(selected.effectScore) && sign(selected.effectScore) !== 0;
  });

  base.maximumEvidenceSupportedEffect = selected.effectScore;
  base.humanRelevance = selected.humanRelevance;
  base.confidence = selected.evidenceConfidence;
  base.dominantDirection =
    selected.effectDirection === "CONTEXT_DEPENDENT" ||
    selected.effectDirection === "BIPHASIC" ||
    selected.effectDirection === "MIXED" ||
    selected.effectDirection === "PHYSIOLOGICAL"
      ? selected.effectDirection
      : selected.effectScore > 0
        ? "DISRUPTIVE"
        : selected.effectScore < 0
          ? "PROTECTIVE"
          : "UNKNOWN";

  if (opposing.length > 0) {
    base.dominantDirection = "MIXED";
    const strongestOpposition = opposing.some(
      (cluster) => CONFIDENCE_RANK[cluster.selected.evidenceConfidence] >= CONFIDENCE_RANK.LOW,
    );
    if (strongestOpposition) {
      base.confidence = downgrade(selected.evidenceConfidence);
      base.confidenceAdjusted = true;
    }
  }

  const winningRows = numeric.filter(
    (row) => row.aggregationGroup === selected.aggregationGroup,
  );
  base.numberOfSupportingFindings = winningRows.reduce(
    (sum, row) => sum + row.supportingFindingCount,
    0,
  );
  base.numberOfContradictoryFindings =
    winningRows.reduce((sum, row) => sum + row.contradictoryFindingCount, 0) +
    opposing.reduce((sum, cluster) => {
      return (
        sum +
        cluster.selected.supportingFindingCount +
        cluster.selected.contradictoryFindingCount
      );
    }, 0);

  sentences.unshift(
    `Headline ${signed(selected.effectScore)} is the strongest independent cluster (${selected.aggregationGroup}: ${selected.mechanismName}). Other clusters and child mechanisms were not added.`,
  );
  if (base.numberOfCappedObservations > 0) {
    sentences.push(
      `${base.numberOfCappedObservations} same-pathway observation${base.numberOfCappedObservations === 1 ? "" : "s"} capped.`,
    );
  }
  if (clusterSelections.length > 1) {
    sentences.push(
      `Also present, not summed: ${clusterSelections
        .slice(1)
        .map((cluster) => `${cluster.selected.aggregationGroup} ${signed(cluster.selected.effectScore)}`)
        .join("; ")}.`,
    );
  }
  sentences.push(
    "Human relevance is the relevance of the headline cluster, not the maximum relevance anywhere in the domain, and it is not multiplied into the score.",
  );
  if (base.confidenceAdjusted) {
    sentences.push(
      "Displayed confidence is one step lower because an opposing cluster is also recorded.",
    );
  }
  if (selected.conflictingEvidence) {
    sentences.push("The headline assessment itself is flagged as conflicting.");
  }
  if (base.physiologicalMagnitude) {
    sentences.push(
      `This domain also has ${base.physiologicalMagnitude.toLowerCase().replaceAll("_", " ")} physiological activity, which is not converted into the signed score.`,
    );
  }
  if (base.numberOfSupportingFindings === 0) {
    sentences.push(
      "No curated scientific findings are linked yet. The number is a seed assessment, not a literature count.",
    );
  }
  const cappedCodes = base.trace.flatMap((cluster) => cluster.cappedMechanismCodes);
  if (cappedCodes.length > 0) {
    sentences.push(`Capped same-pathway nodes: ${cappedCodes.join(", ")}.`);
  }
  sentences.push(
    `Direction ${selected.effectDirection}. Confidence ${base.confidence}. Human relevance ${base.humanRelevance}. Supporting findings ${base.numberOfSupportingFindings}. Contradictory findings ${base.numberOfContradictoryFindings}. Curation ${selected.curationStatus ?? "not recorded"}.`,
  );

  base.summaryText = sentences.join(" ");
  return base;
}

export function describePathways(
  rows: Array<{
    pathwayCode: string;
    pathwayName: string;
    domainShortLabel: string;
    effectScore: number | null;
  }>,
): string[] {
  const grouped = new Map<string, { name: string; domains: Set<string> }>();
  for (const row of rows) {
    const existing = grouped.get(row.pathwayCode) ?? {
      name: row.pathwayName,
      domains: new Set<string>(),
    };
    existing.domains.add(row.domainShortLabel);
    grouped.set(row.pathwayCode, existing);
  }

  const notes: string[] = [];
  for (const entry of grouped.values()) {
    if (entry.domains.size < 2) continue;
    const labels = [...entry.domains].join(", ");
    notes.push(
      `${entry.name} is tagged across ${labels}. Those domain signals are shown as a profile and are not added together.`,
    );
  }
  return notes;
}
