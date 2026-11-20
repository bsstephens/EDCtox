/**
 * Backfill provider metadata onto publications already stored.
 *
 * Layer 0 of docs/SCREENING_REDESIGN.md. Papers imported before that layer existed carry no
 * publication types and no MeSH indexing, and most are stored as sourceType UNSPECIFIED even
 * where PubMed had already said "Meta-Analysis". This re-reads them from PubMed by PMID and
 * fills what the provider states.
 *
 * No model, no cost, and nothing here is a judgement. It writes four provider columns, and it
 * sets sourceType only where the publication type decides it. It never touches an assessment,
 * a finding, a screening decision, or countsAsScientificEvidence.
 *
 *   npm run literature:backfill -- --dry-run
 *   npm run literature:backfill -- --apply
 */
import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";

import { PrismaClient } from "../generated/prisma";
import { parsePubmedArticles } from "../src/server/literature/parsePubmed";
import { evidenceTypeFromProvider, providerFacts } from "../src/server/literature/providerFacts";

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

const NCBI = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const BATCH = 100;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchBatch(pmids: string[], apiKey?: string, email?: string): Promise<string> {
  const params = new URLSearchParams({ db: "pubmed", retmode: "xml", id: pmids.join(",") });
  if (email) params.set("email", email);
  if (apiKey) params.set("api_key", apiKey);
  const response = await fetch(`${NCBI}/efetch.fcgi?${params}`, {
    headers: { "User-Agent": email ? `EDCtox (${email})` : "EDCtox" },
  });
  if (!response.ok) throw new Error(`PubMed efetch returned ${response.status}`);
  return response.text();
}

async function confirmApply(host: string) {
  if (host.includes("localhost") || host.includes("127.0.0.1")) return;
  const prompt = createInterface({ input, output });
  const answer = await prompt.question(`This writes provider metadata to ${host}. Type apply to continue: `);
  prompt.close();
  if (answer.trim() !== "apply") {
    console.log("Stopped.");
    process.exit(1);
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (dryRun === apply) {
    console.error("Pass either --dry-run or --apply.");
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const host = new URL(process.env.DATABASE_URL).host;
  if (apply) await confirmApply(host);

  const db = new PrismaClient();
  try {
    const sources = await db.evidenceSource.findMany({
      where: { pmid: { not: null }, publicationTypes: { isEmpty: true } },
      select: { id: true, pmid: true, title: true, sourceType: true },
      orderBy: { pmid: "asc" },
    });
    console.log(`${sources.length} publications have a PMID and no provider metadata.`);
    if (sources.length === 0) return;

    const byPmid = new Map(sources.map((source) => [source.pmid as string, source]));
    const pmids = [...byPmid.keys()];
    let indexed = 0;
    let typed = 0;
    let missing = 0;

    for (let start = 0; start < pmids.length; start += BATCH) {
      const batch = pmids.slice(start, start + BATCH);
      const xml = await fetchBatch(batch, process.env.NCBI_API_KEY, process.env.NCBI_EMAIL);
      const papers = parsePubmedArticles(xml);
      const returned = new Set<string>();

      for (const paper of papers) {
        if (!paper.pmid) continue;
        returned.add(paper.pmid);
        const source = byPmid.get(paper.pmid);
        if (!source) continue;
        const facts = providerFacts(paper.provider);
        const evidenceType = evidenceTypeFromProvider(facts);
        // Only fill a source type that is still unclassified. A curator's classification wins.
        const setsType = evidenceType !== null && source.sourceType === "UNSPECIFIED";
        if (facts.indexed) indexed += 1;
        if (setsType) typed += 1;

        const line = [
          paper.pmid.padEnd(9),
          facts.indexed ? "indexed  " : "unindexed",
          (facts.evidenceSynthesis ?? (facts.narrativeReview ? "narrative review" : "-")).padEnd(18),
          facts.humans === null ? "species ?" : `humans ${facts.humans ? "y" : "n"}/animals ${facts.animals ? "y" : "n"}`,
          setsType ? `type -> ${evidenceType}` : "",
        ].join(" ");
        console.log(`  ${line}`);

        if (apply) {
          await db.evidenceSource.update({
            where: { id: source.id },
            data: {
              publicationTypes: paper.provider.publicationTypes,
              meshDescriptors: paper.provider.meshDescriptors,
              meshSubstances: paper.provider.meshSubstances,
              providerIndexedAt: paper.provider.indexedAt ? new Date(paper.provider.indexedAt) : null,
              ...(setsType && evidenceType ? { sourceType: evidenceType } : {}),
            },
          });
        }
      }
      missing += batch.filter((pmid) => !returned.has(pmid)).length;
      await sleep(process.env.NCBI_API_KEY ? 120 : 400);
    }

    console.log(
      `\n${apply ? "Wrote" : "Would write"} metadata for ${pmids.length - missing} publications.` +
        ` ${indexed} carry MeSH indexing, ${pmids.length - missing - indexed} do not.` +
        ` ${typed} gain a source type from the provider.` +
        (missing > 0 ? ` ${missing} PMIDs returned nothing and were left alone.` : ""),
    );
    if (dryRun) console.log("Dry run. Nothing was written.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
