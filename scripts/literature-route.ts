/**
 * Derive the compound-and-domain contexts each profiled paper belongs to. Layer 2 of
 * docs/SCREENING_REDESIGN.md.
 *
 *   npm run literature:route -- --report
 *
 * Deterministic and free: no model call, no network, and in this form no write either. Re-running
 * after a compound is added costs nothing and no paper is read again, which is the whole point of
 * reading each paper once in layer 1.
 */
import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "../generated/prisma";
import {
  OUTCOME_CATEGORY_DOMAIN,
  buildOntologyIndex,
  routeProfile,
  type CompoundRecord,
} from "../src/server/literature/routing";
import { providerFacts } from "../src/server/literature/providerFacts";
import { deriveDecisions } from "../src/server/literature/derivedScreening";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(new URL("../.env", import.meta.url).pathname);

function top(counts: Map<string, number>, limit: number): string {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([key, count]) => `${key} ${count}`)
    .join(", ");
}

async function main() {
  const apply = process.argv.includes("--apply");
  if (apply && !process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  if (apply) {
    const host = new URL(process.env.DATABASE_URL ?? "postgres://localhost").host;
    // Derived screening writes machine columns. It stays local until the lane guard of phase 4C,
    // the same boundary every other machine stage respects.
    if (!host.includes("localhost") && !host.includes("127.0.0.1")) {
      console.error(`Refusing to write derived screening to ${host}. This stage is local until the 4C lane guard.`);
      process.exit(1);
    }
    const prompt = createInterface({ input, output });
    const answer = await prompt.question("This writes machine screening decisions locally. Type apply to continue: ");
    prompt.close();
    if (answer.trim() !== "apply") {
      console.log("Stopped.");
      process.exit(1);
    }
  }

  const db = new PrismaClient();
  try {
    const [profiles, compoundRows, outcomes, mechanisms] = await Promise.all([
      db.paperProfile.findMany({
        include: {
          evidenceSource: {
            select: {
              title: true,
              publicationTypes: true,
              meshDescriptors: true,
              meshSubstances: true,
              providerIndexedAt: true,
            },
          },
        },
        orderBy: { createdAt: "asc" },
      }),
      db.compound.findMany({
        select: {
          slug: true, displayName: true, canonicalName: true, casNumber: true, recordKind: true,
          aliases: { select: { name: true } },
        },
      }),
      db.outcome.findMany({ select: { name: true, category: true } }),
      db.mechanism.findMany({ select: { name: true, domain: { select: { shortLabel: true } } } }),
    ]);

    const compounds: CompoundRecord[] = compoundRows.map((row) => ({
      slug: row.slug,
      displayName: row.displayName,
      canonicalName: row.canonicalName,
      casNumber: row.casNumber,
      aliases: row.aliases.map((alias) => alias.name),
      recordKind: row.recordKind,
    }));
    const ontology = buildOntologyIndex({
      outcomes,
      mechanisms: mechanisms.map((row) => ({ name: row.name, domainShortLabel: row.domain.shortLabel })),
      outcomeCategoryToDomain: OUTCOME_CATEGORY_DOMAIN,
    });

    const byDomain = new Map<string, number>();
    const byCompound = new Map<string, number>();
    const unmatched = new Map<string, number>();
    const unmatchedClasses = new Map<string, number>();
    const unmapped = new Map<string, number>();
    let contexts = 0;
    let routedNowhere = 0;
    let exposureOnly = 0;
    let written = 0;
    let keptCuratorDecisions = 0;
    const decisionCounts = new Map<string, number>();
    const compoundIdBySlug = new Map(compoundRows.map((row) => [row.slug, row.slug]));
    const compoundIds = new Map(
      (await db.compound.findMany({ select: { id: true, slug: true } })).map((row) => [row.slug, row.id]),
    );
    void compoundIdBySlug;

    for (const profile of profiles) {
      const facts = providerFacts({
        publicationTypes: profile.evidenceSource.publicationTypes,
        meshDescriptors: profile.evidenceSource.meshDescriptors,
        meshSubstances: profile.evidenceSource.meshSubstances,
        indexedAt: profile.evidenceSource.providerIndexedAt?.toISOString() ?? null,
      });
      const result = routeProfile({ profile, facts, compounds, ontology });
      contexts += result.contexts.length;
      if (result.exposureOnly) exposureOnly += 1;
      else if (result.contexts.length === 0) routedNowhere += 1;
      for (const context of result.contexts) {
        byDomain.set(context.domain, (byDomain.get(context.domain) ?? 0) + 1);
        byCompound.set(context.compoundSlug, (byCompound.get(context.compoundSlug) ?? 0) + 1);
      }
      for (const name of result.unmatchedCompounds) {
        unmatched.set(name, (unmatched.get(name) ?? 0) + 1);
      }
      for (const term of result.unmatchedClasses) {
        unmatchedClasses.set(term.toLowerCase(), (unmatchedClasses.get(term.toLowerCase()) ?? 0) + 1);
      }
      for (const term of result.unmappedTerms) unmapped.set(term, (unmapped.get(term) ?? 0) + 1);

      const decisions = deriveDecisions({ routing: result, facts });
      for (const decision of decisions) {
        const key = `${decision.decision} ${decision.reason}`;
        decisionCounts.set(key, (decisionCounts.get(key) ?? 0) + 1);
      }
      if (!apply) continue;

      for (const decision of decisions) {
        const compoundId = compoundIds.get(decision.compoundSlug);
        if (!compoundId) continue;
        const where = {
          evidenceSourceId_compoundId_domainCode: {
            evidenceSourceId: profile.evidenceSourceId,
            compoundId,
            domainCode: decision.domain,
          },
        };
        const existing = await db.literatureScreeningDecision.findUnique({ where, select: { curatorDecision: true } });
        if (existing?.curatorDecision) {
          // A curator has decided this context. The machine side may be refreshed beside it, and
          // the curator's own columns are never touched by this stage.
          keptCuratorDecisions += 1;
        }
        const machine = {
          machineDecision: decision.decision,
          machineReason: decision.reason,
          machineConfidence: decision.confidence,
          machineRationale: decision.rationale,
        } as const;
        await db.literatureScreeningDecision.upsert({
          where,
          update: machine,
          create: {
            evidenceSourceId: profile.evidenceSourceId,
            compoundId,
            domainCode: decision.domain,
            ...machine,
          },
        });
        written += 1;
      }
    }

    console.log(`${profiles.length} profiles routed into ${contexts} compound-and-domain contexts.`);
    console.log(`  ${exposureOnly} measure exposure only and route nowhere, by design.`);
    console.log(`  ${routedNowhere} report an outcome but matched no compound or no domain.`);
    console.log(`\nContexts by domain:  ${top(byDomain, 12)}`);
    console.log(`Contexts by compound: ${top(byCompound, 10)}`);
    console.log(`\nChemical classes with no placeholder record:\n  ${top(unmatchedClasses, 14)}`);
    console.log(`\nCompound names no record matched:\n  ${top(unmatched, 14)}`);
    console.log(`\nIndexed terms the ontology does not hold (gap signal):\n  ${top(unmapped, 18)}`);
    console.log(`\nDerived screening decisions: ${top(decisionCounts, 10)}`);
    if (apply) {
      console.log(
        `\nWrote ${written} machine screening decisions.` +
          (keptCuratorDecisions > 0
            ? ` ${keptCuratorDecisions} contexts already carry a curator decision, which was left as it is.`
            : ""),
      );
    } else {
      console.log(`\nNothing was written. Routing is derived and can be re-run at any time for nothing.`);
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
