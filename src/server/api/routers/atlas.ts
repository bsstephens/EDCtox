import { z } from "zod";

import { getCompound, listCompounds, listEvidence, atlasCounts } from "~/server/atlas/queries";
import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";
import { PROFILE_LABELS } from "~/lib/labels";

const filterInput = z.object({
  q: z.string().optional(),
  compoundType: z.string().optional(),
  domain: z.string().optional(),
  direction: z.string().optional(),
  confidence: z.string().optional(),
  humanRelevance: z.string().optional(),
  lifeStage: z.string().optional(),
  legacy: z.string().optional(),
  exposureClass: z.string().optional(),
  evidenceType: z.string().optional(),
  recordKind: z.string().optional(),
  minAbsScore: z.number().int().min(1).max(4).optional(),
  sort: z.string().optional(),
});

export const atlasRouter = createTRPCRouter({
  list: publicProcedure.input(filterInput).query(async ({ input }) => {
    const compounds = await listCompounds();
    const query = input.q?.trim().toLowerCase();
    const filtered = compounds.filter((compound) => {
      if (query) {
        const haystack = [compound.displayName, compound.canonicalName, compound.slug, ...compound.aliases]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (input.compoundType && compound.compoundType !== input.compoundType) return false;
      if (input.recordKind && compound.recordKind !== input.recordKind) return false;
      if (input.legacy === "legacy" && !compound.legacyChemical) return false;
      if (input.legacy === "current" && compound.legacyChemical) return false;
      if (input.lifeStage && !compound.lifeStages.includes(input.lifeStage)) return false;
      if (input.evidenceType && !compound.evidenceTypes.includes(input.evidenceType)) return false;
      if (input.exposureClass === "therapeutic" && !compound.isPharmaceutical && !compound.exposureTypes.includes("THERAPEUTIC")) {
        return false;
      }
      if (
        input.exposureClass === "environmental" &&
        !compound.isEnvironmentalChemical &&
        !compound.exposureTypes.some((type) => type === "ENVIRONMENTAL" || type === "DIETARY" || type === "OCCUPATIONAL")
      ) {
        return false;
      }

      const cells = input.domain ? [compound.domains[input.domain]].filter(Boolean) : Object.values(compound.domains);
      if (input.direction === "DISRUPTIVE" && !cells.some((cell) => cell && cell.maximumEvidenceSupportedEffect !== null && cell.maximumEvidenceSupportedEffect > 0)) {
        return false;
      }
      if (input.direction === "PROTECTIVE" && !cells.some((cell) => cell && cell.maximumEvidenceSupportedEffect !== null && cell.maximumEvidenceSupportedEffect < 0)) {
        return false;
      }
      if (input.direction === "PHYSIOLOGICAL" && !cells.some((cell) => cell?.physiologicalMagnitude)) return false;
      if (input.direction === "MIXED" && !cells.some((cell) => cell?.dominantDirection === "MIXED")) return false;
      if (input.direction === "CONTEXT_DEPENDENT" && !cells.some((cell) => cell?.dominantDirection === "CONTEXT_DEPENDENT")) {
        return false;
      }
      if (input.confidence && !cells.some((cell) => cell?.confidence === input.confidence)) return false;
      if (input.humanRelevance && !cells.some((cell) => cell?.humanRelevance === input.humanRelevance)) return false;
      if (
        input.minAbsScore &&
        !cells.some(
          (cell) =>
            cell?.maximumEvidenceSupportedEffect !== null &&
            cell?.maximumEvidenceSupportedEffect !== undefined &&
            Math.abs(cell.maximumEvidenceSupportedEffect) >= input.minAbsScore!,
        )
      ) {
        return false;
      }
      return true;
    });

    const sort = input.sort ?? "name";
    filtered.sort((a, b) => {
      if (sort === "name") return a.displayName.localeCompare(b.displayName);
      if ((PROFILE_LABELS as readonly string[]).includes(sort)) {
        const aScore = a.domains[sort]?.maximumEvidenceSupportedEffect;
        const bScore = b.domains[sort]?.maximumEvidenceSupportedEffect;
        if (aScore === null || aScore === undefined) return 1;
        if (bScore === null || bScore === undefined) return -1;
        return bScore - aScore;
      }
      return a.displayName.localeCompare(b.displayName);
    });
    return filtered;
  }),

  bySlug: publicProcedure.input(z.object({ slug: z.string() })).query(async ({ input }) => {
    return getCompound(input.slug);
  }),

  compare: publicProcedure
    .input(z.object({ slugs: z.array(z.string().min(1)).min(2).max(6) }))
    .query(async ({ input }) => {
      const compounds = [];
      for (const slug of input.slugs) {
        const compound = await getCompound(slug);
        if (compound) compounds.push(compound);
      }
      return compounds;
    }),

  evidence: publicProcedure
    .input(
      z.object({
        compoundSlug: z.string().optional(),
        mechanismCode: z.string().optional(),
        domain: z.string().optional(),
        species: z.string().optional(),
        evidenceClass: z.string().optional(),
        year: z.number().int().optional(),
        lifeStage: z.string().optional(),
        studyDesign: z.string().optional(),
        confidence: z.string().optional(),
        sex: z.string().optional(),
        tissue: z.string().optional(),
        studyQuality: z.string().optional(),
        doseMetricType: z.string().optional(),
        mechanismFamily: z.string().optional(),
      }),
    )
    .query(async ({ input }) => listEvidence(input)),

  counts: publicProcedure.query(async () => atlasCounts()),
});
