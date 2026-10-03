import { PrismaClient } from "../generated/prisma";

import { biologicalContexts } from "../src/data/seeds/biologicalContexts";
import { externalDatasets } from "../src/data/seeds/externalDatasets";
import { compounds } from "../src/data/seeds/compounds";
import { domains } from "../src/data/seeds/domains";
import {
  dataGaps,
  evidenceFindings,
  evidenceSources,
  exposureSeeds,
  interactions,
  mechanismAssessments,
  metabolicTransformations,
  outcomeAssessments,
  pathways,
  relationships,
} from "../src/data/seeds/initialAssessments";
import { mechanismFamilies } from "../src/data/seeds/gutVascularMechanisms";
import { mechanisms } from "../src/data/seeds/mechanisms";
import { outcomeSeeds } from "../src/data/seeds/outcomes";
import { descriptiveScoreError } from "../src/server/scoring/compositionScores";
import { assertEffectSemantics } from "../src/server/scoring/effectSemantics";

const db = new PrismaClient();
const reviewedAt = new Date("2026-10-01T00:00:00.000Z");

async function main() {
  for (const domain of domains) {
    await db.biologicalDomain.upsert({
      where: { code: domain.code },
      update: {
        name: domain.name,
        shortLabel: domain.shortLabel,
        description: domain.description,
        contributesToProfile: domain.contributesToProfile,
        sortOrder: domain.sortOrder,
      },
      create: {
        code: domain.code,
        name: domain.name,
        shortLabel: domain.shortLabel,
        description: domain.description,
        contributesToProfile: domain.contributesToProfile,
        sortOrder: domain.sortOrder,
      },
    });
  }

  const domainIds = new Map(
    (await db.biologicalDomain.findMany()).map((domain) => [domain.code, domain.id]),
  );

  for (const context of biologicalContexts) {
    await db.biologicalContext.upsert({
      where: { stableKey: context.stableKey },
      update: {
        organ: context.organ ?? null,
        tissue: context.tissue ?? null,
        cellType: context.cellType ?? null,
        subcellularCompartment: context.subcellularCompartment ?? null,
        notes: context.notes,
      },
      create: {
        stableKey: context.stableKey,
        organ: context.organ ?? null,
        tissue: context.tissue ?? null,
        cellType: context.cellType ?? null,
        subcellularCompartment: context.subcellularCompartment ?? null,
        notes: context.notes,
      },
    });
  }

  const contextIds = new Map(
    (await db.biologicalContext.findMany()).map((context) => [context.stableKey, context.id]),
  );

  for (const family of mechanismFamilies) {
    await db.mechanismFamily.upsert({
      where: { code: family.code },
      update: {
        name: family.name,
        description: family.description,
        sortOrder: family.sortOrder,
      },
      create: {
        code: family.code,
        name: family.name,
        description: family.description,
        sortOrder: family.sortOrder,
      },
    });
  }

  const familyIds = new Map(
    (await db.mechanismFamily.findMany()).map((family) => [family.code, family.id]),
  );

  const parents = mechanisms.filter((mechanism) => !mechanism.parentCode);
  const children = mechanisms.filter((mechanism) => mechanism.parentCode);

  for (const mechanism of [...parents, ...children]) {
    const domainId = domainIds.get(mechanism.domainCode);
    if (!domainId) throw new Error(`Missing domain ${mechanism.domainCode}`);
    const familyId = mechanism.familyCode
      ? familyIds.get(mechanism.familyCode)
      : null;
    if (mechanism.familyCode && !familyId) {
      throw new Error(`Missing family ${mechanism.familyCode}`);
    }
    await db.mechanism.upsert({
      where: { code: mechanism.code },
      update: {
        domainId,
        familyId: familyId ?? null,
        name: mechanism.name,
        description: mechanism.description,
        aggregationGroup: mechanism.aggregationGroup,
        scorePolicy: mechanism.scorePolicy,
        quantitativeScoreByDefault: mechanism.quantitativeScoreByDefault ?? true,
        sortOrder: mechanism.sortOrder,
      },
      create: {
        domainId,
        familyId: familyId ?? null,
        code: mechanism.code,
        name: mechanism.name,
        description: mechanism.description,
        aggregationGroup: mechanism.aggregationGroup,
        scorePolicy: mechanism.scorePolicy,
        quantitativeScoreByDefault: mechanism.quantitativeScoreByDefault ?? true,
        sortOrder: mechanism.sortOrder,
      },
    });
  }

  const mechanismIds = new Map(
    (await db.mechanism.findMany()).map((mechanism) => [mechanism.code, mechanism.id]),
  );

  for (const mechanism of children) {
    const id = mechanismIds.get(mechanism.code);
    const parentId = mechanism.parentCode ? mechanismIds.get(mechanism.parentCode) : undefined;
    if (!id || !parentId) throw new Error(`Missing parent for ${mechanism.code}`);
    await db.mechanism.update({
      where: { id },
      data: { parentMechanismId: parentId },
    });
  }

  for (const outcome of outcomeSeeds) {
    await db.outcome.upsert({
      where: { code: outcome.code },
      update: {
        name: outcome.name,
        category: outcome.category,
        description: outcome.description,
      },
      create: {
        code: outcome.code,
        name: outcome.name,
        category: outcome.category,
        description: outcome.description,
      },
    });
  }

  for (const pathway of pathways) {
    await db.causalPathway.upsert({
      where: { code: pathway.code },
      update: { name: pathway.name, description: pathway.description },
      create: pathway,
    });
  }

  const withoutParents = compounds.filter((compound) => !compound.parentSlug);
  const withParents = compounds.filter((compound) => compound.parentSlug);

  for (const compound of [...withoutParents, ...withParents]) {
    const parent = compound.parentSlug
      ? await db.compound.findUnique({ where: { slug: compound.parentSlug } })
      : null;
    if (compound.parentSlug && !parent) {
      throw new Error(`Parent ${compound.parentSlug} is not seeded before ${compound.slug}`);
    }
    await db.compound.upsert({
      where: { slug: compound.slug },
      update: {
        canonicalName: compound.canonicalName,
        displayName: compound.displayName,
        description: compound.description,
        compoundType: compound.compoundType,
        primaryCategory: compound.primaryCategory,
        currentUseStatus: compound.currentUseStatus,
        recordKind: compound.recordKind,
        casNumber: compound.casNumber ?? null,
        molecularFormula: compound.molecularFormula ?? null,
        parentCompoundId: parent?.id ?? null,
        isMetabolite: compound.isMetabolite ?? false,
        isMixture: compound.isMixture ?? false,
        isEndogenous: compound.isEndogenous ?? false,
        isPharmaceutical: compound.isPharmaceutical ?? false,
        isEnvironmentalChemical: compound.isEnvironmentalChemical ?? false,
        legacyChemical: compound.legacyChemical ?? false,
        notes: compound.notes ?? "",
      },
      create: {
        slug: compound.slug,
        canonicalName: compound.canonicalName,
        displayName: compound.displayName,
        description: compound.description,
        compoundType: compound.compoundType,
        primaryCategory: compound.primaryCategory,
        currentUseStatus: compound.currentUseStatus,
        recordKind: compound.recordKind,
        casNumber: compound.casNumber,
        molecularFormula: compound.molecularFormula,
        parentCompoundId: parent?.id,
        isMetabolite: compound.isMetabolite ?? false,
        isMixture: compound.isMixture ?? false,
        isEndogenous: compound.isEndogenous ?? false,
        isPharmaceutical: compound.isPharmaceutical ?? false,
        isEnvironmentalChemical: compound.isEnvironmentalChemical ?? false,
        legacyChemical: compound.legacyChemical ?? false,
        notes: compound.notes ?? "",
      },
    });

    if (compound.aliases) {
      const saved = await db.compound.findUniqueOrThrow({ where: { slug: compound.slug } });
      for (const alias of compound.aliases) {
        await db.compoundAlias.upsert({
          where: { compoundId_name: { compoundId: saved.id, name: alias.name } },
          update: { aliasType: alias.aliasType },
          create: { compoundId: saved.id, name: alias.name, aliasType: alias.aliasType },
        });
      }
    }
  }

  const compoundIds = new Map(
    (await db.compound.findMany()).map((compound) => [compound.slug, compound.id]),
  );
  const pathwayIds = new Map(
    (await db.causalPathway.findMany()).map((pathway) => [pathway.code, pathway.id]),
  );
  const outcomeIds = new Map(
    (await db.outcome.findMany()).map((outcome) => [outcome.code, outcome.id]),
  );

  for (const exposure of exposureSeeds) {
    const compoundId = required(compoundIds, exposure.compoundSlug, "compound");
    await db.exposureContext.upsert({
      where: { compoundId_contextKey: { compoundId, contextKey: exposure.contextKey } },
      update: {
        route: exposure.route as never,
        population: exposure.population,
        lifeStage: exposure.lifeStage as never,
        exposureType: exposure.exposureType as never,
        therapeuticVsEnvironmental: exposure.therapeuticVsEnvironmental as never,
        occupational: exposure.occupational,
        maternalExposure: exposure.maternalExposure,
        realWorldRelevance: exposure.realWorldRelevance as never,
        doseMetricType: exposure.doseMetricType as never,
        developmentalWindow: exposure.developmentalWindow,
        notes: exposure.notes,
      },
      create: {
        compoundId,
        contextKey: exposure.contextKey,
        route: exposure.route as never,
        population: exposure.population,
        lifeStage: exposure.lifeStage as never,
        exposureType: exposure.exposureType as never,
        therapeuticVsEnvironmental: exposure.therapeuticVsEnvironmental as never,
        occupational: exposure.occupational,
        maternalExposure: exposure.maternalExposure,
        realWorldRelevance: exposure.realWorldRelevance as never,
        doseMetricType: exposure.doseMetricType as never,
        developmentalWindow: exposure.developmentalWindow,
        notes: exposure.notes,
      },
    });
  }

  for (const assessment of mechanismAssessments) {
    assertEffectSemantics(
      assessment,
      `${assessment.compoundSlug} ${assessment.mechanismCode}`,
    );
    const seededMechanism = mechanisms.find((row) => row.code === assessment.mechanismCode);
    if (!seededMechanism) throw new Error(`Missing mechanism ${assessment.mechanismCode}`);
    const compositionProblem = descriptiveScoreError({
      quantitativeScoreByDefault: seededMechanism.quantitativeScoreByDefault ?? true,
      effectScore: assessment.effectScore,
      quantitativeScoreSupported: assessment.quantitativeScoreSupported,
    });
    if (compositionProblem) {
      throw new Error(`${assessment.compoundSlug} ${assessment.mechanismCode}: ${compositionProblem}`);
    }
    const compoundId = required(compoundIds, assessment.compoundSlug, "compound");
    const mechanismId = required(mechanismIds, assessment.mechanismCode, "mechanism");
    const exposure = assessment.exposureContextKey
      ? await db.exposureContext.findUnique({
          where: {
            compoundId_contextKey: { compoundId, contextKey: assessment.exposureContextKey },
          },
        })
      : null;
    if (assessment.exposureContextKey && !exposure) {
      throw new Error(`Missing exposure ${assessment.exposureContextKey} for ${assessment.compoundSlug}`);
    }
    const causalPathwayId = assessment.pathwayCode
      ? required(pathwayIds, assessment.pathwayCode, "pathway")
      : null;

    const biologicalContextId = assessment.biologicalContextKey
      ? required(contextIds, assessment.biologicalContextKey, "biological context")
      : null;
    const data = {
      exposureContextId: exposure?.id ?? null,
      biologicalContextId,
      causalPathwayId,
      effectScore: assessment.quantitativeScoreSupported ? assessment.effectScore : null,
      effectDirection: assessment.effectDirection,
      activityMagnitude: assessment.activityMagnitude,
      evidenceConfidence: assessment.evidenceConfidence,
      humanRelevance: assessment.humanRelevance,
      developmentalSensitivity: assessment.developmentalSensitivity,
      conflictingEvidence: assessment.conflictingEvidence,
      insufficientHumanEvidence: assessment.insufficientHumanEvidence,
      doseRelevanceUncertain: assessment.doseRelevanceUncertain,
      developmentalRelevanceUncertain: assessment.developmentalRelevanceUncertain,
      quantitativeScoreSupported: assessment.quantitativeScoreSupported,
      effectSummary: assessment.effectSummary,
      mechanismSummary: assessment.mechanismSummary,
      limitations: assessment.limitations,
      lastReviewedAt: reviewedAt,
    };

    const existing = await db.mechanismAssessment.findUnique({
      where: {
        compoundId_mechanismId_assessmentKey: {
          compoundId,
          mechanismId,
          assessmentKey: assessment.assessmentKey,
        },
      },
    });

    if (!existing) {
      const created = await db.mechanismAssessment.create({
        data: {
          compoundId,
          mechanismId,
          assessmentKey: assessment.assessmentKey,
          reviewVersion: 1,
          curationStatus: "SEED_HYPOTHESIS",
          ...data,
        },
      });
      await db.assessmentRevision.create({
        data: {
          mechanismAssessmentId: created.id,
          previousEffectScore: null,
          newEffectScore: created.effectScore,
          previousConfidence: null,
          newConfidence: created.evidenceConfidence,
          previousSnapshot: undefined,
          newSnapshot: judgmentSnapshot(created),
          reason: "Initial seed hypothesis, version 1. Not a curated consensus.",
        },
      });
      continue;
    }

    const changed =
      existing.effectScore !== data.effectScore ||
      existing.evidenceConfidence !== data.evidenceConfidence ||
      existing.effectDirection !== data.effectDirection ||
      existing.humanRelevance !== data.humanRelevance;

    if (!changed) {
      await db.mechanismAssessment.update({ where: { id: existing.id }, data });
      continue;
    }

    await db.mechanismAssessment.update({
      where: { id: existing.id },
      data: { ...data, reviewVersion: existing.reviewVersion + 1 },
    });
    await db.assessmentRevision.create({
      data: {
        mechanismAssessmentId: existing.id,
        previousEffectScore: existing.effectScore,
        newEffectScore: data.effectScore,
        previousConfidence: existing.evidenceConfidence,
        newConfidence: data.evidenceConfidence,
        previousSnapshot: judgmentSnapshot(existing),
        newSnapshot: judgmentSnapshot({ ...existing, ...data }),
        reason: "Seed upsert changed a scientific judgment. Previous values were retained in this revision.",
      },
    });
  }

  for (const assessment of outcomeAssessments) {
    assertEffectSemantics(assessment, `${assessment.compoundSlug} ${assessment.outcomeCode}`);
    const compoundId = required(compoundIds, assessment.compoundSlug, "compound");
    const outcomeId = required(outcomeIds, assessment.outcomeCode, "outcome");
    const exposure = assessment.exposureContextKey
      ? await db.exposureContext.findUnique({
          where: {
            compoundId_contextKey: { compoundId, contextKey: assessment.exposureContextKey },
          },
        })
      : null;
    const data = {
      exposureContextId: exposure?.id ?? null,
      effectScore: assessment.effectScore,
      effectDirection: assessment.effectDirection,
      activityMagnitude: assessment.activityMagnitude,
      evidenceConfidence: assessment.evidenceConfidence,
      humanRelevance: assessment.humanRelevance,
      lifeStage: assessment.lifeStage ?? null,
      insufficientHumanEvidence: assessment.insufficientHumanEvidence ?? false,
      doseRelevanceUncertain: assessment.doseRelevanceUncertain ?? false,
      developmentalRelevanceUncertain: assessment.developmentalRelevanceUncertain ?? false,
      quantitativeScoreSupported: assessment.effectScore !== null,
      effectSummary: assessment.effectSummary,
      limitations: assessment.limitations,
      lastReviewedAt: reviewedAt,
      curationStatus: "SEED_HYPOTHESIS" as const,
    };
    const existing = await db.compoundOutcomeAssessment.findUnique({
      where: {
        compoundId_outcomeId_assessmentKey: {
          compoundId,
          outcomeId,
          assessmentKey: assessment.assessmentKey,
        },
      },
    });
    if (!existing) {
      const created = await db.compoundOutcomeAssessment.create({
        data: { compoundId, outcomeId, assessmentKey: assessment.assessmentKey, reviewVersion: 1, ...data },
      });
      await db.assessmentRevision.create({
        data: {
          outcomeAssessmentId: created.id,
          previousEffectScore: null,
          newEffectScore: created.effectScore,
          newConfidence: created.evidenceConfidence,
          newSnapshot: judgmentSnapshot(created),
          reason: "Initial outcome seed hypothesis, version 1.",
        },
      });
    } else if (
      existing.effectScore !== data.effectScore ||
      existing.evidenceConfidence !== data.evidenceConfidence
    ) {
      await db.compoundOutcomeAssessment.update({
        where: { id: existing.id },
        data: { ...data, reviewVersion: existing.reviewVersion + 1 },
      });
      await db.assessmentRevision.create({
        data: {
          outcomeAssessmentId: existing.id,
          previousEffectScore: existing.effectScore,
          newEffectScore: data.effectScore,
          previousConfidence: existing.evidenceConfidence,
          newConfidence: data.evidenceConfidence,
          previousSnapshot: judgmentSnapshot(existing),
          newSnapshot: judgmentSnapshot({ ...existing, ...data }),
          reason: "Seed upsert changed an outcome judgment.",
        },
      });
    } else {
      await db.compoundOutcomeAssessment.update({ where: { id: existing.id }, data });
    }
  }

  for (const source of evidenceSources) {
    await db.evidenceSource.upsert({
      where: { stableKey: source.stableKey },
      update: {
        title: source.title,
        authors: source.authors,
        journalOrPublisher: source.journalOrPublisher,
        year: source.year,
        sourceType: source.sourceType,
        peerReviewed: source.peerReviewed,
        countsAsScientificEvidence: source.countsAsScientificEvidence,
        notes: source.notes,
      },
      create: source,
    });
  }

  for (const finding of evidenceFindings) {
    const source = await db.evidenceSource.findUniqueOrThrow({ where: { stableKey: finding.sourceKey } });
    const compoundId = required(compoundIds, finding.compoundSlug, "compound");
    const mechanismId = required(mechanismIds, finding.mechanismCode, "mechanism");
    const assessment = await db.mechanismAssessment.findUniqueOrThrow({
      where: {
        compoundId_mechanismId_assessmentKey: {
          compoundId,
          mechanismId,
          assessmentKey: finding.assessmentKey,
        },
      },
    });
    await db.evidenceFinding.upsert({
      where: { stableKey: finding.stableKey },
      update: {
        findingSummary: finding.findingSummary,
        ourInterpretation: finding.ourInterpretation,
        limitations: finding.limitations,
        relevanceScore: finding.relevanceScore,
        sex: finding.sex,
        studyQuality: finding.studyQuality,
        doseMetricType: finding.doseMetricType,
      },
      create: {
        stableKey: finding.stableKey,
        sourceId: source.id,
        compoundId,
        mechanismAssessmentId: assessment.id,
        species: finding.species,
        sex: finding.sex,
        studyQuality: finding.studyQuality,
        doseMetricType: finding.doseMetricType,
        studyDesign: finding.studyDesign,
        evidenceClass: finding.evidenceClass,
        doseText: finding.doseText,
        durationText: finding.durationText,
        findingSummary: finding.findingSummary,
        effectDirection: finding.effectDirection,
        ourInterpretation: finding.ourInterpretation,
        limitations: finding.limitations,
        relevanceScore: finding.relevanceScore,
      },
    });
  }

  for (const [sourceSlug, targetSlug, relationshipType, description] of relationships) {
    await db.compoundRelationship.upsert({
      where: {
        sourceCompoundId_targetCompoundId_relationshipType: {
          sourceCompoundId: required(compoundIds, sourceSlug, "compound"),
          targetCompoundId: required(compoundIds, targetSlug, "compound"),
          relationshipType,
        },
      },
      update: { description },
      create: {
        sourceCompoundId: required(compoundIds, sourceSlug, "compound"),
        targetCompoundId: required(compoundIds, targetSlug, "compound"),
        relationshipType,
        description,
      },
    });
  }

  for (const transformation of metabolicTransformations) {
    await db.metabolicTransformation.upsert({
      where: { stableKey: transformation.stableKey },
      update: {
        transformationType: transformation.transformationType,
        activeMetabolite: transformation.activeMetabolite,
        reactiveMetabolite: transformation.reactiveMetabolite,
        toxicologicallyRelevant: transformation.toxicologicallyRelevant,
        summary: transformation.summary,
      },
      create: {
        stableKey: transformation.stableKey,
        parentCompoundId: required(compoundIds, transformation.parentSlug, "compound"),
        productCompoundId: required(compoundIds, transformation.productSlug, "compound"),
        transformationType: transformation.transformationType,
        activeMetabolite: transformation.activeMetabolite,
        reactiveMetabolite: transformation.reactiveMetabolite,
        toxicologicallyRelevant: transformation.toxicologicallyRelevant,
        summary: transformation.summary,
      },
    });
  }

  for (const interaction of interactions) {
    const compoundAId = required(compoundIds, interaction.compoundASlug, "compound");
    const exposure = interaction.exposureContextKey
      ? await db.exposureContext.findUnique({
          where: {
            compoundId_contextKey: {
              compoundId: compoundAId,
              contextKey: interaction.exposureContextKey,
            },
          },
        })
      : null;
    if (interaction.exposureContextKey && !exposure) {
      throw new Error(`Missing exposure ${interaction.exposureContextKey} for ${interaction.stableKey}`);
    }
    assertEffectSemantics(
      {
        effectScore: interaction.effectScore,
        effectDirection: interaction.effectScore !== null && interaction.effectScore < 0 ? "PROTECTIVE" : "UNKNOWN",
      },
      interaction.stableKey,
    );
    await db.compoundInteraction.upsert({
      where: { stableKey: interaction.stableKey },
      update: {
        effectScore: interaction.effectScore,
        confidence: interaction.confidence,
        humanRelevance: interaction.humanRelevance,
        summary: interaction.summary,
        limitations: interaction.limitations,
        exposureContextId: exposure?.id ?? null,
        biologicalContextId: interaction.biologicalContextKey
          ? required(contextIds, interaction.biologicalContextKey, "biological context")
          : null,
      },
      create: {
        stableKey: interaction.stableKey,
        compoundAId,
        compoundBId: required(compoundIds, interaction.compoundBSlug, "compound"),
        interactionType: interaction.interactionType,
        domainId: required(domainIds, interaction.domainCode, "domain"),
        mechanismId: required(mechanismIds, interaction.mechanismCode, "mechanism"),
        effectScore: interaction.effectScore,
        confidence: interaction.confidence,
        humanRelevance: interaction.humanRelevance,
        summary: interaction.summary,
        limitations: interaction.limitations,
        curationStatus: "SEED_HYPOTHESIS",
        exposureContextId: exposure?.id ?? null,
        biologicalContextId: interaction.biologicalContextKey
          ? required(contextIds, interaction.biologicalContextKey, "biological context")
          : null,
      },
    });
  }

  for (const [stableKey, compoundSlug, mechanismCode, domainCode, priority, reason, description, suggestedResearch] of dataGaps) {
    await db.dataGap.upsert({
      where: { stableKey },
      update: { description, suggestedResearch, priority, reason },
      create: {
        stableKey,
        compoundId: required(compoundIds, compoundSlug, "compound"),
        mechanismId: mechanismCode ? required(mechanismIds, mechanismCode, "mechanism") : null,
        domainId: domainCode ? required(domainIds, domainCode, "domain") : null,
        priority,
        reason,
        description,
        suggestedResearch,
      },
    });
  }

  for (const dataset of externalDatasets) {
    await db.externalDataset.upsert({
      where: { code: dataset.code },
      update: {
        name: dataset.name,
        organisation: dataset.organisation,
        jurisdiction: dataset.jurisdiction,
        description: dataset.description,
        baseUrl: dataset.baseUrl,
        apiUrl: dataset.apiUrl ?? null,
        documentationUrl: dataset.documentationUrl ?? null,
        licence: dataset.licence,
        accessType: dataset.accessType,
        roles: dataset.roles,
        notes: dataset.notes,
        active: true,
      },
      create: {
        code: dataset.code,
        name: dataset.name,
        organisation: dataset.organisation,
        jurisdiction: dataset.jurisdiction,
        description: dataset.description,
        baseUrl: dataset.baseUrl,
        apiUrl: dataset.apiUrl ?? null,
        documentationUrl: dataset.documentationUrl ?? null,
        licence: dataset.licence,
        accessType: dataset.accessType,
        roles: dataset.roles,
        notes: dataset.notes,
        active: true,
      },
    });
  }

  const counts = {
    compounds: await db.compound.count(),
    mechanisms: await db.mechanism.count(),
    mechanismAssessments: await db.mechanismAssessment.count(),
    findings: await db.evidenceFinding.count(),
    sources: await db.evidenceSource.count(),
    externalDatasets: await db.externalDataset.count(),
    externalRecords: await db.externalRecord.count(),
    externalIdentifiers: await db.externalIdentifier.count(),
    assayObservations: await db.assayObservation.count(),
    ontologyMappings: await db.externalOntologyMapping.count(),
  };
  console.log("Seed complete", counts);
}

function judgmentSnapshot(row: {
  effectDirection: string;
  humanRelevance: string;
  activityMagnitude: string;
  curationStatus: string;
  effectScore: number | null;
}) {
  return {
    effectDirection: row.effectDirection,
    humanRelevance: row.humanRelevance,
    activityMagnitude: row.activityMagnitude,
    curationStatus: row.curationStatus,
    effectScore: row.effectScore,
  };
}

function required(map: Map<string, string>, key: string, label: string): string {
  const value = map.get(key);
  if (!value) throw new Error(`Missing ${label}: ${key}`);
  return value;
}

main()
  .then(async () => {
    await db.$disconnect();
  })
  .catch(async (error) => {
    console.error(error);
    await db.$disconnect();
    process.exit(1);
  });
