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
        select: { slug: true, displayName: true, canonicalName: true, casNumber: true, aliases: { select: { name: true } } },
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
    }));
    const ontology = buildOntologyIndex({
      outcomes,
      mechanisms: mechanisms.map((row) => ({ name: row.name, domainShortLabel: row.domain.shortLabel })),
      outcomeCategoryToDomain: OUTCOME_CATEGORY_DOMAIN,
    });

    const byDomain = new Map<string, number>();
    const byCompound = new Map<string, number>();
    const unmatched = new Map<string, number>();
    const unmapped = new Map<string, number>();
    let contexts = 0;
    let routedNowhere = 0;
    let exposureOnly = 0;

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
      for (const term of result.unmappedTerms) unmapped.set(term, (unmapped.get(term) ?? 0) + 1);
    }

    console.log(`${profiles.length} profiles routed into ${contexts} compound-and-domain contexts.`);
    console.log(`  ${exposureOnly} measure exposure only and route nowhere, by design.`);
    console.log(`  ${routedNowhere} report an outcome but matched no compound or no domain.`);
    console.log(`\nContexts by domain:  ${top(byDomain, 12)}`);
    console.log(`Contexts by compound: ${top(byCompound, 10)}`);
    console.log(`\nCompounds named with no record (candidates to add):\n  ${top(unmatched, 18)}`);
    console.log(`\nIndexed terms the ontology does not hold (gap signal):\n  ${top(unmapped, 18)}`);
    console.log(`\nNothing was written. Routing is derived and can be re-run at any time for nothing.`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
