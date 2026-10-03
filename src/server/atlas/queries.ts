import { formatBiologicalContext } from "~/lib/labels";
import { db } from "~/server/db";
import { isCacheStale } from "~/server/external/identity";
import {
  describePathways,
  summarizeDomain,
  type Confidence,
  type DomainSummary,
  type HumanRelevance,
  type SummarizableAssessment,
} from "~/server/scoring/summarize";

const assessmentInclude = {
  mechanism: { include: { domain: true, parent: true } },
  causalPathway: true,
  exposureContext: true,
  biologicalContext: true,
  findings: {
    include: {
      source: true,
      biologicalContext: true,
      measurements: { orderBy: { endpoint: "asc" as const } },
    },
  },
  revisions: { orderBy: { changedAt: "desc" as const }, take: 8 },
};

function decimalText(value: { toString(): string } | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return value.toString();
}

function findingCounts(
  findings: Array<{ effectDirection: string; source: { countsAsScientificEvidence: boolean } }>,
  effectScore: number | null,
) {
  let supportingFindingCount = 0;
  let contradictoryFindingCount = 0;
  if (effectScore === null) return { supportingFindingCount, contradictoryFindingCount };
  for (const finding of findings) {
    if (!finding.source.countsAsScientificEvidence) continue;
    const findingSign =
      finding.effectDirection === "PROTECTIVE" ? -1 : finding.effectDirection === "DISRUPTIVE" ? 1 : 0;
    const scoreSign = Math.sign(effectScore);
    if (findingSign === 0 || scoreSign === 0) continue;
    if (findingSign === scoreSign) supportingFindingCount += 1;
    else contradictoryFindingCount += 1;
  }
  return { supportingFindingCount, contradictoryFindingCount };
}

function toSummarizable(
  assessment: {
    effectScore: number | null;
    effectDirection: string;
    activityMagnitude: string;
    evidenceConfidence: string;
    humanRelevance: string;
    conflictingEvidence: boolean;
    quantitativeScoreSupported: boolean;
    curationStatus: string;
    causalPathway: { code: string } | null;
    mechanism: {
      code: string;
      name: string;
      aggregationGroup: string;
      scorePolicy: "SCORABLE" | "RESEARCH_ONLY" | "GROUPING_ONLY";
    };
    findings: Array<{ effectDirection: string; source: { countsAsScientificEvidence: boolean } }>;
  },
): SummarizableAssessment {
  const counts = findingCounts(assessment.findings, assessment.effectScore);
  return {
    mechanismCode: assessment.mechanism.code,
    mechanismName: assessment.mechanism.name,
    aggregationGroup: assessment.mechanism.aggregationGroup,
    scorePolicy: assessment.mechanism.scorePolicy,
    effectScore: assessment.effectScore,
    effectDirection: assessment.effectDirection,
    activityMagnitude: assessment.activityMagnitude,
    evidenceConfidence: assessment.evidenceConfidence as Confidence,
    humanRelevance: assessment.humanRelevance as HumanRelevance,
    conflictingEvidence: assessment.conflictingEvidence,
    quantitativeScoreSupported: assessment.quantitativeScoreSupported,
    curationStatus: assessment.curationStatus,
    causalPathwayCode: assessment.causalPathway?.code ?? null,
    ...counts,
  };
}

export type DomainCell = DomainSummary;

export type CompoundListItem = {
  slug: string;
  displayName: string;
  canonicalName: string;
  primaryCategory: string;
  compoundType: string;
  recordKind: string;
  legacyChemical: boolean;
  isPharmaceutical: boolean;
  isEnvironmentalChemical: boolean;
  aliases: string[];
  domains: Record<string, DomainCell>;
  humanRelevanceLabel: string;
  confidenceLabel: string;
  lastReviewed: string | null;
  lifeStages: string[];
  exposureTypes: string[];
  evidenceTypes: string[];
};

const HUMAN_ORDER = ["H0", "H1", "H2", "H3", "H4"];
const CONFIDENCE_ORDER = ["VERY_LOW", "LOW", "MODERATE", "HIGH", "VERY_HIGH"];

function spanLabel(values: Array<string | null>, order: string[]): string {
  const present = order.filter((value) => values.includes(value));
  const first = present[0];
  const last = present[present.length - 1];
  if (!first || !last) return "—";
  if (first === last) return first;
  return `${first}–${last}`;
}

type LoadedCompound = Awaited<ReturnType<typeof loadCompounds>>[number];

async function loadCompounds() {
  return db.compound.findMany({
    orderBy: { displayName: "asc" },
    include: {
      aliases: true,
      exposureContexts: true,
      findings: { include: { source: true } },
      mechanismAssessments: { include: assessmentInclude },
    },
  });
}

function cellsFor(compound: LoadedCompound): Record<string, DomainCell> {
  const domains = new Map<string, { code: string; shortLabel: string; contributes: boolean; rows: SummarizableAssessment[] }>();
  for (const assessment of compound.mechanismAssessments) {
    const domain = assessment.mechanism.domain;
    const existing = domains.get(domain.shortLabel) ?? {
      code: domain.code,
      shortLabel: domain.shortLabel,
      contributes: domain.contributesToProfile,
      rows: [],
    };
    existing.rows.push(toSummarizable(assessment));
    domains.set(domain.shortLabel, existing);
  }

  const known = [
    ["REPRODUCTIVE_ENDOCRINOLOGY", "REP", true],
    ["DEVELOPMENTAL_ENDOCRINOLOGY", "DEV", true],
    ["NEUROENDOCRINE_HPA_CIRCADIAN", "NEUROENDO", true],
    ["IMMUNOLOGY_IMMUNOENDOCRINOLOGY", "IMM", true],
    ["SYSTEMIC_METABOLISM", "MET", true],
    ["MITOCHONDRIAL_BIOENERGETICS", "MITO", true],
    ["REDOX_CELLULAR_STRESS", "REDOX", true],
  ] as const;

  const result: Record<string, DomainCell> = {};
  for (const [code, shortLabel, contributes] of known) {
    const found = domains.get(shortLabel);
    result[shortLabel] = summarizeDomain({
      domainCode: code,
      shortLabel,
      contributesToProfile: contributes,
      assessments: found?.rows ?? [],
    });
  }
  return result;
}

function toListItem(compound: LoadedCompound): CompoundListItem {
  const domains = cellsFor(compound);
  const headlines = Object.values(domains);
  const reviewed = compound.mechanismAssessments
    .map((assessment) => assessment.lastReviewedAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((a, b) => b.getTime() - a.getTime())[0];

  return {
    slug: compound.slug,
    displayName: compound.displayName,
    canonicalName: compound.canonicalName,
    primaryCategory: compound.primaryCategory,
    compoundType: compound.compoundType,
    recordKind: compound.recordKind,
    legacyChemical: compound.legacyChemical,
    isPharmaceutical: compound.isPharmaceutical,
    isEnvironmentalChemical: compound.isEnvironmentalChemical,
    aliases: compound.aliases.map((alias) => alias.name),
    domains,
    humanRelevanceLabel: spanLabel(
      headlines.map((cell) => cell.humanRelevance),
      HUMAN_ORDER,
    ),
    confidenceLabel: spanLabel(
      headlines.map((cell) => cell.confidence),
      CONFIDENCE_ORDER,
    ),
    lastReviewed: reviewed ? reviewed.toISOString() : null,
    lifeStages: [...new Set(compound.exposureContexts.map((context) => context.lifeStage))],
    exposureTypes: [...new Set(compound.exposureContexts.map((context) => context.exposureType))],
    evidenceTypes: [
      ...new Set(compound.findings.map((finding) => finding.evidenceClass)),
    ],
  };
}

export async function listCompounds(): Promise<CompoundListItem[]> {
  const compounds = await loadCompounds();
  return compounds.map(toListItem);
}

function serializeAssessment(
  assessment: LoadedCompound["mechanismAssessments"][number],
) {
  return {
    id: assessment.id,
    assessmentKey: assessment.assessmentKey,
    effectScore: assessment.effectScore,
    effectDirection: assessment.effectDirection,
    activityMagnitude: assessment.activityMagnitude,
    evidenceConfidence: assessment.evidenceConfidence,
    humanRelevance: assessment.humanRelevance,
    developmentalSensitivity: assessment.developmentalSensitivity,
    doseResponse: assessment.doseResponse,
    reversibility: assessment.reversibility,
    conflictingEvidence: assessment.conflictingEvidence,
    insufficientHumanEvidence: assessment.insufficientHumanEvidence,
    doseRelevanceUncertain: assessment.doseRelevanceUncertain,
    developmentalRelevanceUncertain: assessment.developmentalRelevanceUncertain,
    quantitativeScoreSupported: assessment.quantitativeScoreSupported,
    curationStatus: assessment.curationStatus,
    effectSummary: assessment.effectSummary,
    mechanismSummary: assessment.mechanismSummary,
    limitations: assessment.limitations,
    reviewVersion: assessment.reviewVersion,
    lastReviewedAt: assessment.lastReviewedAt?.toISOString() ?? null,
    exposureLabel: assessment.exposureContext
      ? `${assessment.exposureContext.exposureType.toLowerCase().replaceAll("_", " ")} · ${assessment.exposureContext.lifeStage.toLowerCase().replaceAll("_", " ")} · ${assessment.exposureContext.population}`
      : null,
    biologicalContextLabel: formatBiologicalContext(assessment.biologicalContext),
    pathwayName: assessment.causalPathway?.name ?? null,
    pathwayCode: assessment.causalPathway?.code ?? null,
    findings: assessment.findings.map((finding) => ({
      id: finding.id,
      sourceTitle: finding.source.title,
      sourceYear: finding.source.year,
      sourceId: finding.source.id,
      countsAsScientificEvidence: finding.source.countsAsScientificEvidence,
      peerReviewed: finding.source.peerReviewed,
      evidenceClass: finding.evidenceClass,
      species: finding.species,
      sex: finding.sex,
      sexDetail: finding.sexDetail,
      studyQuality: finding.studyQuality,
      doseMetricType: finding.doseMetricType,
      biologicalContextLabel: formatBiologicalContext(finding.biologicalContext),
      studyDesign: finding.studyDesign,
      doseText: finding.doseText,
      durationText: finding.durationText,
      findingSummary: finding.findingSummary,
      effectDirection: finding.effectDirection,
      ourInterpretation: finding.ourInterpretation,
      limitations: finding.limitations,
      authorsConclusion: finding.authorsConclusion,
      measurements: finding.measurements.map((measurement) => ({
        id: measurement.id,
        endpoint: measurement.endpoint,
        analyte: measurement.analyte,
        value: decimalText(measurement.value),
        unit: measurement.unit,
        effectSize: decimalText(measurement.effectSize),
        effectSizeType: measurement.effectSizeType,
        percentChange: decimalText(measurement.percentChange),
        pValue: decimalText(measurement.pValue),
        confidenceIntervalLow: decimalText(measurement.confidenceIntervalLow),
        confidenceIntervalHigh: decimalText(measurement.confidenceIntervalHigh),
        notes: measurement.notes,
      })),
    })),
    revisions: assessment.revisions.map((revision) => ({
      id: revision.id,
      previousEffectScore: revision.previousEffectScore,
      newEffectScore: revision.newEffectScore,
      previousConfidence: revision.previousConfidence,
      newConfidence: revision.newConfidence,
      reason: revision.reason,
      changedAt: revision.changedAt.toISOString(),
    })),
  };
}

export async function getCompound(slug: string) {
  const compound = await db.compound.findUnique({
    where: { slug },
    include: {
      aliases: { orderBy: { name: "asc" } },
      parentCompound: { select: { slug: true, displayName: true } },
      metabolites: { select: { slug: true, displayName: true } },
      exposureContexts: { orderBy: { contextKey: "asc" } },
      mechanismAssessments: { include: assessmentInclude },
      outcomeAssessments: {
        include: {
          outcome: true,
          exposureContext: true,
          biologicalContext: true,
          findings: { include: { source: true } },
        },
        orderBy: { outcome: { name: "asc" } },
      },
      relationshipsFrom: { include: { targetCompound: true } },
      relationshipsTo: { include: { sourceCompound: true } },
      interactionsAsA: {
        include: {
          compoundB: true,
          domain: true,
          mechanism: true,
          biologicalContext: true,
          exposureContext: true,
        },
      },
      interactionsAsB: {
        include: {
          compoundA: true,
          domain: true,
          mechanism: true,
          biologicalContext: true,
          exposureContext: true,
        },
      },
      transformationsAsParent: { include: { productCompound: true } },
      transformationsAsProduct: { include: { parentCompound: true } },
      regulatoryAssessments: true,
      dataGaps: { include: { domain: true, mechanism: true }, orderBy: { priority: "asc" } },
      externalIdentifiers: { include: { dataset: true }, orderBy: [{ namespace: "asc" }, { value: "asc" }] },
      externalRecords: {
        select: {
          recordType: true,
          externalUrl: true,
          retrievedAt: true,
          expiresAt: true,
          sourceVersion: true,
          dataset: { select: { code: true, name: true } },
        },
        orderBy: { retrievedAt: "desc" },
      },
      findings: {
        include: {
          source: true,
          biologicalContext: true,
          measurements: { orderBy: { endpoint: "asc" } },
          mechanismAssessment: { include: { mechanism: true } },
        },
      },
    },
  });
  if (!compound) return null;

  const listShape = await db.compound.findUniqueOrThrow({
    where: { slug },
    include: {
      aliases: true,
      exposureContexts: true,
      findings: { include: { source: true } },
      mechanismAssessments: { include: assessmentInclude },
    },
  });
  const domains = cellsFor(listShape);

  const mechanisms = await db.mechanism.findMany({
    include: { domain: true, parent: true },
    orderBy: [{ domain: { sortOrder: "asc" } }, { sortOrder: "asc" }],
  });
  const assessmentsByMechanism = new Map<string, typeof compound.mechanismAssessments>();
  for (const assessment of compound.mechanismAssessments) {
    const list = assessmentsByMechanism.get(assessment.mechanismId) ?? [];
    list.push(assessment);
    assessmentsByMechanism.set(assessment.mechanismId, list);
  }

  const domainBuckets = new Map<
    string,
    {
      code: string;
      shortLabel: string;
      name: string;
      contributesToProfile: boolean;
      mechanisms: Array<{
        code: string;
        name: string;
        description: string;
        aggregationGroup: string;
        scorePolicy: string;
        parentName: string | null;
        assessments: ReturnType<typeof serializeAssessment>[];
      }>;
    }
  >();

  for (const mechanism of mechanisms) {
    const bucket = domainBuckets.get(mechanism.domain.code) ?? {
      code: mechanism.domain.code,
      shortLabel: mechanism.domain.shortLabel,
      name: mechanism.domain.name,
      contributesToProfile: mechanism.domain.contributesToProfile,
      mechanisms: [],
    };
    const rows = assessmentsByMechanism.get(mechanism.id) ?? [];
    if (rows.length === 0 && mechanism.scorePolicy === "GROUPING_ONLY") {
      domainBuckets.set(mechanism.domain.code, bucket);
      continue;
    }
    if (rows.length === 0) continue;
    bucket.mechanisms.push({
      code: mechanism.code,
      name: mechanism.name,
      description: mechanism.description,
      aggregationGroup: mechanism.aggregationGroup,
      scorePolicy: mechanism.scorePolicy,
      parentName: mechanism.parent?.name ?? null,
      assessments: rows.map(serializeAssessment),
    });
    domainBuckets.set(mechanism.domain.code, bucket);
  }

  const pathwayNotes = describePathways(
    compound.mechanismAssessments.flatMap((assessment) => {
      if (!assessment.causalPathway) return [];
      return [
        {
          pathwayCode: assessment.causalPathway.code,
          pathwayName: assessment.causalPathway.name,
          domainShortLabel: assessment.mechanism.domain.shortLabel,
          effectScore: assessment.effectScore,
        },
      ];
    }),
  );

  return {
    slug: compound.slug,
    displayName: compound.displayName,
    canonicalName: compound.canonicalName,
    description: compound.description,
    compoundType: compound.compoundType,
    primaryCategory: compound.primaryCategory,
    currentUseStatus: compound.currentUseStatus,
    recordKind: compound.recordKind,
    casNumber: compound.casNumber,
    molecularFormula: compound.molecularFormula,
    isMixture: compound.isMixture,
    isEndogenous: compound.isEndogenous,
    isPharmaceutical: compound.isPharmaceutical,
    isEnvironmentalChemical: compound.isEnvironmentalChemical,
    legacyChemical: compound.legacyChemical,
    notes: compound.notes,
    aliases: compound.aliases.map((alias) => ({ name: alias.name, aliasType: alias.aliasType })),
    parent: compound.parentCompound,
    metabolites: compound.metabolites,
    domains,
    pathwayNotes,
    domainSections: [...domainBuckets.values()].filter((section) => section.mechanisms.length > 0),
    outcomes: compound.outcomeAssessments.map((assessment) => ({
      code: assessment.outcome.code,
      name: assessment.outcome.name,
      category: assessment.outcome.category,
      effectScore: assessment.effectScore,
      effectDirection: assessment.effectDirection,
      activityMagnitude: assessment.activityMagnitude,
      evidenceConfidence: assessment.evidenceConfidence,
      humanRelevance: assessment.humanRelevance,
      lifeStage: assessment.lifeStage,
      effectSummary: assessment.effectSummary,
      limitations: assessment.limitations,
      curationStatus: assessment.curationStatus,
      quantitativeScoreSupported: assessment.quantitativeScoreSupported,
      exposureLabel: assessment.exposureContext?.population ?? null,
      biologicalContextLabel: formatBiologicalContext(assessment.biologicalContext),
    })),
    exposures: compound.exposureContexts.map((context) => ({
      contextKey: context.contextKey,
      route: context.route,
      population: context.population,
      lifeStage: context.lifeStage,
      exposureType: context.exposureType,
      doseMetricType: context.doseMetricType,
      doseRangeText: context.doseRangeText,
      therapeuticVsEnvironmental: context.therapeuticVsEnvironmental,
      occupational: context.occupational,
      developmentalWindow: context.developmentalWindow,
      maternalExposure: context.maternalExposure,
      realWorldRelevance: context.realWorldRelevance,
      notes: context.notes,
    })),
    relationships: [
      ...compound.relationshipsFrom.map((relationship) => ({
        direction: "outgoing" as const,
        type: relationship.relationshipType,
        otherSlug: relationship.targetCompound.slug,
        otherName: relationship.targetCompound.displayName,
        description: relationship.description,
      })),
      ...compound.relationshipsTo.map((relationship) => ({
        direction: "incoming" as const,
        type: relationship.relationshipType,
        otherSlug: relationship.sourceCompound.slug,
        otherName: relationship.sourceCompound.displayName,
        description: relationship.description,
      })),
    ],
    interactions: [
      ...compound.interactionsAsA.map((interaction) => ({
        otherSlug: interaction.compoundB.slug,
        otherName: interaction.compoundB.displayName,
        interactionType: interaction.interactionType,
        domain: interaction.domain?.shortLabel ?? null,
        mechanism: interaction.mechanism?.name ?? null,
        effectScore: interaction.effectScore,
        confidence: interaction.confidence,
        humanRelevance: interaction.humanRelevance,
        summary: interaction.summary,
        limitations: interaction.limitations,
        curationStatus: interaction.curationStatus,
        biologicalContextLabel: formatBiologicalContext(interaction.biologicalContext),
        exposureLabel: interaction.exposureContext?.population ?? null,
      })),
      ...compound.interactionsAsB.map((interaction) => ({
        otherSlug: interaction.compoundA.slug,
        otherName: interaction.compoundA.displayName,
        interactionType: interaction.interactionType,
        domain: interaction.domain?.shortLabel ?? null,
        mechanism: interaction.mechanism?.name ?? null,
        effectScore: interaction.effectScore,
        confidence: interaction.confidence,
        humanRelevance: interaction.humanRelevance,
        summary: interaction.summary,
        limitations: interaction.limitations,
        curationStatus: interaction.curationStatus,
        biologicalContextLabel: formatBiologicalContext(interaction.biologicalContext),
        exposureLabel: interaction.exposureContext?.population ?? null,
      })),
    ],
    transformations: [
      ...compound.transformationsAsParent.map((row) => ({
        stableKey: row.stableKey,
        role: "parent" as const,
        otherSlug: row.productCompound.slug,
        otherName: row.productCompound.displayName,
        transformationType: row.transformationType,
        summary: row.summary,
        activeMetabolite: row.activeMetabolite,
        toxicologicallyRelevant: row.toxicologicallyRelevant,
      })),
      ...compound.transformationsAsProduct.map((row) => ({
        stableKey: row.stableKey,
        role: "product" as const,
        otherSlug: row.parentCompound.slug,
        otherName: row.parentCompound.displayName,
        transformationType: row.transformationType,
        summary: row.summary,
        activeMetabolite: row.activeMetabolite,
        toxicologicallyRelevant: row.toxicologicallyRelevant,
      })),
    ],
    regulatory: compound.regulatoryAssessments.map((assessment) => ({
      agency: assessment.agency,
      jurisdiction: assessment.jurisdiction,
      conclusionKind: assessment.conclusionKind,
      classification: assessment.classification,
      referenceDoseKind: assessment.referenceDoseKind,
      referenceDose: assessment.referenceDose?.toString() ?? null,
      referenceDoseUnit: assessment.referenceDoseUnit,
      uncertaintyFactor: assessment.uncertaintyFactor,
      populationBasis: assessment.populationBasis,
      criticalEndpoint: assessment.criticalEndpoint,
      summary: assessment.summary,
      url: assessment.url,
      current: assessment.current,
    })),
    externalIdentifiers: compound.externalIdentifiers.map((identifier) => ({
      namespace: identifier.namespace,
      value: identifier.value,
      canonical: identifier.canonical,
      disputed: identifier.disputed,
      resolutionStatus: identifier.resolutionStatus,
      verifiedAt: identifier.verifiedAt?.toISOString() ?? null,
      sourceUrl: identifier.sourceUrl,
      notes: identifier.notes,
      datasetCode: identifier.dataset?.code ?? null,
      datasetName: identifier.dataset?.name ?? null,
    })),
    externalRecords: compound.externalRecords.map((record) => ({
      datasetName: record.dataset.name,
      recordType: record.recordType,
      externalUrl: record.externalUrl,
      retrievedAt: record.retrievedAt?.toISOString() ?? null,
      sourceVersion: record.sourceVersion,
      stale: isCacheStale(record.expiresAt),
    })),
    inchiKey: compound.inchiKey,
    canonicalSmiles: compound.canonicalSmiles,
    dataGaps: compound.dataGaps.map((gap) => ({
      priority: gap.priority,
      reason: gap.reason,
      description: gap.description,
      suggestedResearch: gap.suggestedResearch,
      domain: gap.domain?.shortLabel ?? null,
      mechanism: gap.mechanism?.name ?? null,
    })),
    evidence: compound.findings.map((finding) => ({
      id: finding.id,
      sourceId: finding.source.id,
      sourceTitle: finding.source.title,
      year: finding.source.year,
      countsAsScientificEvidence: finding.source.countsAsScientificEvidence,
      evidenceClass: finding.evidenceClass,
      species: finding.species,
      sex: finding.sex,
      studyQuality: finding.studyQuality,
      doseMetricType: finding.doseMetricType,
      biologicalContextLabel: formatBiologicalContext(finding.biologicalContext),
      studyDesign: finding.studyDesign,
      findingSummary: finding.findingSummary,
      measurements: finding.measurements.map((measurement) => ({
        id: measurement.id,
        endpoint: measurement.endpoint,
        value: decimalText(measurement.value),
        unit: measurement.unit,
        pValue: decimalText(measurement.pValue),
        effectSizeType: measurement.effectSizeType,
      })),
      effectDirection: finding.effectDirection,
      mechanism: finding.mechanismAssessment?.mechanism.name ?? null,
      ourInterpretation: finding.ourInterpretation,
      limitations: finding.limitations,
    })),
  };
}

export async function listEvidence(input: {
  compoundSlug?: string;
  mechanismCode?: string;
  domain?: string;
  species?: string;
  evidenceClass?: string;
  year?: number;
  lifeStage?: string;
  studyDesign?: string;
  confidence?: string;
  sex?: string;
  tissue?: string;
  studyQuality?: string;
  doseMetricType?: string;
  mechanismFamily?: string;
}) {
  const tissue = input.tissue?.trim();
  const findings = await db.evidenceFinding.findMany({
    where: {
      compound: input.compoundSlug ? { slug: input.compoundSlug } : undefined,
      species: input.species ? { contains: input.species, mode: "insensitive" } : undefined,
      sex: input.sex ? (input.sex as never) : undefined,
      studyQuality: input.studyQuality ? (input.studyQuality as never) : undefined,
      doseMetricType: input.doseMetricType ? (input.doseMetricType as never) : undefined,
      evidenceClass: input.evidenceClass ? (input.evidenceClass as never) : undefined,
      studyDesign: input.studyDesign ? (input.studyDesign as never) : undefined,
      source: input.year ? { year: input.year } : undefined,
      exposureContext: input.lifeStage ? { lifeStage: input.lifeStage as never } : undefined,
      biologicalContext: tissue
        ? {
            OR: [
              { organ: { contains: tissue, mode: "insensitive" } },
              { tissue: { contains: tissue, mode: "insensitive" } },
              { cellType: { contains: tissue, mode: "insensitive" } },
              { subcellularCompartment: { contains: tissue, mode: "insensitive" } },
            ],
          }
        : undefined,
      mechanismAssessment:
        input.mechanismCode || input.domain || input.confidence || input.mechanismFamily
          ? {
              evidenceConfidence: input.confidence ? (input.confidence as never) : undefined,
              mechanism: {
                code: input.mechanismCode,
                domain: input.domain ? { shortLabel: input.domain } : undefined,
                family: input.mechanismFamily ? { code: input.mechanismFamily } : undefined,
              },
            }
          : undefined,
    },
    include: {
      source: true,
      compound: true,
      exposureContext: true,
      biologicalContext: true,
      mechanismAssessment: { include: { mechanism: { include: { domain: true } } } },
      outcomeAssessment: { include: { outcome: true } },
    },
    orderBy: [{ source: { year: "desc" } }, { stableKey: "asc" }],
  });

  return findings.map((finding) => ({
    id: finding.id,
    sourceId: finding.source.id,
    sourceTitle: finding.source.title,
    year: finding.source.year,
    journal: finding.source.journalOrPublisher,
    peerReviewed: finding.source.peerReviewed,
    countsAsScientificEvidence: finding.source.countsAsScientificEvidence,
    sourceType: finding.source.sourceType,
    compoundSlug: finding.compound.slug,
    compoundName: finding.compound.displayName,
    mechanism: finding.mechanismAssessment?.mechanism.name ?? null,
    domain: finding.mechanismAssessment?.mechanism.domain.shortLabel ?? null,
    outcome: finding.outcomeAssessment?.outcome.name ?? null,
    species: finding.species,
    sex: finding.sex,
    studyQuality: finding.studyQuality,
    doseMetricType: finding.doseMetricType,
    biologicalContextLabel: formatBiologicalContext(finding.biologicalContext),
    evidenceClass: finding.evidenceClass,
    studyDesign: finding.studyDesign,
    lifeStage: finding.exposureContext?.lifeStage ?? null,
    confidence: finding.mechanismAssessment?.evidenceConfidence ?? null,
    findingSummary: finding.findingSummary,
    effectDirection: finding.effectDirection,
    ourInterpretation: finding.ourInterpretation,
    limitations: finding.limitations,
  }));
}

export async function externalDiagnostics() {
  const datasets = await db.externalDataset.findMany({
    orderBy: { code: "asc" },
    include: {
      _count: { select: { identifiers: true, records: true } },
      importRuns: { orderBy: { startedAt: "desc" }, take: 1 },
    },
  });
  return datasets.map((dataset) => ({
    code: dataset.code,
    name: dataset.name,
    accessMode: dataset.accessMode,
    accessType: dataset.accessType,
    requiresApiKey: dataset.requiresApiKey,
    apiKeyConfigured: dataset.requiresApiKey ? Boolean(process.env.EPA_CTX_API_KEY) : false,
    linkedCompounds: dataset._count.identifiers,
    cachedRecords: dataset._count.records,
    lastRunStatus: dataset.importRuns[0]?.status ?? null,
    lastRunAt: dataset.importRuns[0]?.completedAt?.toISOString() ?? dataset.importRuns[0]?.startedAt.toISOString() ?? null,
  }));
}

export async function atlasCounts() {
  const [compounds, mechanisms, assessments, sources, findings, gaps] = await Promise.all([
    db.compound.count(),
    db.mechanism.count(),
    db.mechanismAssessment.count(),
    db.evidenceSource.count(),
    db.evidenceFinding.count(),
    db.dataGap.count(),
  ]);
  return { compounds, mechanisms, assessments, sources, findings, gaps };
}
