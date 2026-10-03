type JudgmentRow = {
  id: string;
  effectScore: number | null;
  effectDirection: string;
  activityMagnitude: string;
  evidenceConfidence: string;
  humanRelevance: string;
  quantitativeScoreSupported: boolean;
  curationStatus: string;
  reviewVersion: number;
  updatedAt: Date;
};

type FindingRow = { id: string; stableKey: string; sourceId: string };

const judgmentSelect = {
  id: true,
  effectScore: true,
  effectDirection: true,
  activityMagnitude: true,
  evidenceConfidence: true,
  humanRelevance: true,
  quantitativeScoreSupported: true,
  curationStatus: true,
  reviewVersion: true,
  updatedAt: true,
} as const;

export type ScientificSnapshot = {
  mechanismCount: number;
  outcomeCount: number;
  findingCount: number;
  mechanisms: string;
  outcomes: string;
  findings: string;
};

export type ScientificReadClient = {
  mechanismAssessment: {
    findMany(args: { orderBy: { id: "asc" }; select: typeof judgmentSelect }): Promise<JudgmentRow[]>;
  };
  compoundOutcomeAssessment: {
    findMany(args: { orderBy: { id: "asc" }; select: typeof judgmentSelect }): Promise<JudgmentRow[]>;
  };
  evidenceFinding: {
    findMany(args: {
      orderBy: { id: "asc" };
      select: { id: true; stableKey: true; sourceId: true };
    }): Promise<FindingRow[]>;
  };
};

function pack(rows: unknown[]): string {
  return JSON.stringify(rows);
}

export async function scientificSnapshot(db: ScientificReadClient): Promise<ScientificSnapshot> {
  const mechanisms = await db.mechanismAssessment.findMany({ orderBy: { id: "asc" }, select: judgmentSelect });
  const outcomes = await db.compoundOutcomeAssessment.findMany({ orderBy: { id: "asc" }, select: judgmentSelect });
  const findings = await db.evidenceFinding.findMany({
    orderBy: { id: "asc" },
    select: { id: true, stableKey: true, sourceId: true },
  });
  return {
    mechanismCount: mechanisms.length,
    outcomeCount: outcomes.length,
    findingCount: findings.length,
    mechanisms: pack(mechanisms),
    outcomes: pack(outcomes),
    findings: pack(findings),
  };
}

export function assertScientificSnapshotUnchanged(before: ScientificSnapshot, after: ScientificSnapshot): void {
  if (before.mechanismCount !== 71) {
    throw new Error(`Expected 71 mechanism assessments before a literature search, found ${before.mechanismCount}.`);
  }
  if (before.mechanisms !== after.mechanisms) {
    throw new Error("Literature search changed mechanism assessments.");
  }
  if (before.outcomes !== after.outcomes) {
    throw new Error("Literature search changed outcome assessments.");
  }
  if (before.findings !== after.findings || before.findingCount !== after.findingCount) {
    throw new Error("Literature search changed evidence findings.");
  }
}
