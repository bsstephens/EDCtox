import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

import { PrismaClient } from "../generated/prisma";
import { CLAIM_DOMAIN, CLAIM_PILOT_PMIDS, CLAIM_PROMPT_VERSION, CLAIM_PROVIDER, CLAIM_TASK } from "../src/server/claims/constants";
import { claimStableKey } from "../src/server/claims/extract";
import { assertScientificSnapshotUnchanged, scientificSnapshot } from "../src/server/literature/guard";

function loadEnvFile(path: string): Record<string, string> {
  if (!existsSync(path)) throw new Error(`Missing ${path}.`);
  const values: Record<string, string> = {};
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
    if (value) values[key] = value;
  }
  return values;
}

function hostname(databaseUrl: string): string {
  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "";
  }
}

function redact(text: string): string {
  return text.replace(/postgres(?:ql)?:\/\/\S+/gi, "[redacted]").replace(/\b[\w.-]*prisma\.io\S*/gi, "[redacted-host]");
}

function assertTargets(localUrl: string, productionUrl: string): void {
  const localHost = hostname(localUrl);
  const productionHost = hostname(productionUrl);
  if (localHost !== "localhost" && localHost !== "127.0.0.1") throw new Error("The local database must be localhost.");
  if (productionHost === "localhost" || productionHost === "127.0.0.1" || productionHost === localHost) {
    throw new Error("Refusing to copy the claim pilot onto localhost.");
  }
  if (!productionHost.endsWith("prisma.io")) throw new Error("The production copy only runs against the hosted Prisma database.");
}

async function main() {
  if (!process.argv.includes("--confirm-production")) {
    throw new Error("Pass --confirm-production. This copies the five-paper claim pilot and nothing else.");
  }
  if (process.argv.includes("--all")) throw new Error("Refusing --all.");

  const localEnv = loadEnvFile(new URL("../.env", import.meta.url).pathname);
  const productionEnv = loadEnvFile(new URL("../.env.production.local", import.meta.url).pathname);
  const localUrl = localEnv.DATABASE_URL;
  const productionUrl = productionEnv.DIRECT_URL ?? productionEnv.DATABASE_URL;
  if (!localUrl || !productionUrl) throw new Error("Both databases need a URL.");
  assertTargets(localUrl, productionUrl);

  const migrated = spawnSync("./node_modules/.bin/prisma", ["migrate", "deploy"], {
    cwd: new URL("..", import.meta.url).pathname,
    env: { ...process.env, DATABASE_URL: productionUrl, DIRECT_URL: productionUrl },
    encoding: "utf8",
  });
  if (migrated.status !== 0) {
    throw new Error(redact(`${migrated.stdout}\n${migrated.stderr}`).slice(0, 500));
  }

  const local = new PrismaClient({ datasources: { db: { url: localUrl } } });
  const production = new PrismaClient({ datasources: { db: { url: productionUrl } } });
  try {
    const before = await scientificSnapshot(production);
    const bpaBefore = await production.compound.findUniqueOrThrow({
      where: { slug: "bpa" },
      select: { id: true, curationStatus: true },
    });
    const sources = await local.evidenceSource.findMany({
      where: { pmid: { in: [...CLAIM_PILOT_PMIDS] }, publicationStatus: "SCREENING_PENDING", retracted: false },
      select: {
        stableKey: true,
        title: true,
        authors: true,
        journalOrPublisher: true,
        year: true,
        publicationDate: true,
        doi: true,
        pmid: true,
        url: true,
        sourceType: true,
        peerReviewed: true,
        retracted: true,
        openAccess: true,
        pmcid: true,
        publicationStatus: true,
        retrievedAt: true,
        mechanisticClaims: {
          where: { domainCode: CLAIM_DOMAIN, compound: { slug: "bpa" } },
          select: {
            subjectType: true,
            subjectText: true,
            relation: true,
            objectType: true,
            objectText: true,
            machineDirectness: true,
            machineConfidence: true,
            machineRationale: true,
            machineMappingState: true,
            speciesText: true,
            tissueText: true,
            cellTypeText: true,
            doseText: true,
            measureType: true,
            measureValue: true,
            measureUnit: true,
            textOrigin: true,
            sourceSection: true,
            quotedSupport: true,
            reviewPriority: true,
            reviewDerived: true,
            provider: true,
            modelName: true,
            promptVersion: true,
            mechanism: { select: { code: true } },
          },
        },
      },
    });
    if (sources.length !== CLAIM_PILOT_PMIDS.length) throw new Error(`Expected ${CLAIM_PILOT_PMIDS.length} local pilot papers, found ${sources.length}.`);
    const claimCount = sources.reduce((sum, source) => sum + source.mechanisticClaims.length, 0);
    if (claimCount < 1) throw new Error("The local pilot has no claims.");

    const mechanisms = await production.mechanism.findMany({ select: { id: true, code: true } });
    const mechanismId = new Map(mechanisms.map((row) => [row.code, row.id]));
    let unmapped = 0;

    const written = await production.$transaction(async (tx) => {
      const snapshot = await scientificSnapshot(tx);
      const copiedSources = [];
      for (const source of sources) {
        const citation = {
          title: source.title,
          authors: source.authors,
          journalOrPublisher: source.journalOrPublisher,
          year: source.year,
          publicationDate: source.publicationDate,
          doi: source.doi,
          pmid: source.pmid,
          url: source.url,
          sourceType: source.sourceType,
          peerReviewed: source.peerReviewed,
          countsAsScientificEvidence: false,
          retracted: source.retracted,
          openAccess: source.openAccess,
          pmcid: source.pmcid,
          publicationStatus: source.publicationStatus,
          retrievedAt: source.retrievedAt,
          abstractText: null,
          notes: "Claim-pilot citation. The full abstract is not stored on this copy.",
        };
        copiedSources.push(
          await tx.evidenceSource.upsert({
            where: { stableKey: source.stableKey },
            create: { stableKey: source.stableKey, ...citation },
            update: citation,
          }),
        );
      }

      const run = await tx.curationAgentRun.create({
        data: {
          taskType: CLAIM_TASK,
          provider: CLAIM_PROVIDER,
          model: CLAIM_PROMPT_VERSION,
          promptVersion: CLAIM_PROMPT_VERSION,
          status: "SUCCEEDED",
          inputRefs: {
            compoundId: bpaBefore.id,
            domainCode: CLAIM_DOMAIN,
            evidenceSourceIds: copiedSources.map((source) => source.id),
          },
          outputRefs: { claims: claimCount, abstractsCopied: 0 },
        },
      });

      let claimsWritten = 0;
      for (const [index, source] of sources.entries()) {
        const copied = copiedSources[index];
        if (!copied) throw new Error("Pilot source copy did not line up.");
        for (const claim of source.mechanisticClaims) {
          const code = claim.mechanism?.code ?? null;
          const resolvedId = code ? (mechanismId.get(code) ?? null) : null;
          if (code && !resolvedId) unmapped += 1;
          const machine = {
            domainCode: CLAIM_DOMAIN,
            subjectType: claim.subjectType,
            subjectText: claim.subjectText,
            relation: claim.relation,
            objectType: claim.objectType,
            objectText: claim.objectText,
            machineDirectness: claim.machineDirectness,
            machineConfidence: claim.machineConfidence,
            machineRationale: claim.machineRationale,
            machineMappingState: resolvedId ? claim.machineMappingState : "UNMAPPED",
            machineMechanismId: resolvedId,
            speciesText: claim.speciesText,
            tissueText: claim.tissueText,
            cellTypeText: claim.cellTypeText,
            doseText: claim.doseText,
            measureType: claim.measureType,
            measureValue: claim.measureValue,
            measureUnit: claim.measureUnit,
            textOrigin: claim.textOrigin,
            sourceSection: claim.sourceSection,
            quotedSupport: claim.quotedSupport,
            reviewPriority: claim.reviewPriority,
            reviewDerived: claim.reviewDerived,
            provider: claim.provider,
            modelName: claim.modelName,
            promptVersion: claim.promptVersion,
            agentRunId: run.id,
          } as const;
          await tx.mechanisticClaim.upsert({
            where: {
              stableKey: claimStableKey(copied.id, claim.subjectText, claim.relation, claim.objectText),
            },
            create: {
              stableKey: claimStableKey(copied.id, claim.subjectText, claim.relation, claim.objectText),
              evidenceSourceId: copied.id,
              compoundId: bpaBefore.id,
              mechanismId: resolvedId,
              ...machine,
            },
            update: machine,
          });
          claimsWritten += 1;
        }
      }
      assertScientificSnapshotUnchanged(snapshot, await scientificSnapshot(tx));
      const curation = await tx.compound.findUniqueOrThrow({ where: { id: bpaBefore.id }, select: { curationStatus: true } });
      if (curation.curationStatus !== bpaBefore.curationStatus) throw new Error("Claim copy changed BPA curation status.");
      return { papers: copiedSources.length, claims: claimsWritten };
    }, { timeout: 120000 });

    const abstracts = await production.evidenceSource.count({
      where: { pmid: { in: [...CLAIM_PILOT_PMIDS] }, abstractText: { not: null } },
    });
    assertScientificSnapshotUnchanged(before, await scientificSnapshot(production));
    console.log(`Copied ${written.papers} papers and ${written.claims} claims. Abstracts stored: ${abstracts}. Mechanisms left unmapped: ${unmapped}. Scores were not changed.`);
  } finally {
    await local.$disconnect();
    await production.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(redact(error instanceof Error ? error.message : "Claim copy failed."));
  process.exitCode = 1;
});
