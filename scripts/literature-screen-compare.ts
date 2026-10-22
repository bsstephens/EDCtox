/**
 * Phase 4A dry run. Reads the BPA reproductive candidates, asks the Claude-backed screener for a
 * suggestion on each, and compares the answers with the stored machine suggestions and with
 * every curator decision. It never writes: no screening decision, no agent run, no score.
 *
 *   npm run literature:screen:compare -- --compound bpa --domain reproductive
 *   npm run literature:screen:compare -- --compound bpa --domain reproductive --from fixture.json --out report.md
 *
 * The transport is chosen by EDCTOX_SCREENING_TRANSPORT (anthropic or claude-code); with no
 * setting it is the API when ANTHROPIC_API_KEY is set, otherwise the Claude Code CLI.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

import { PrismaClient } from "../generated/prisma";
import { assertScientificSnapshotUnchanged, scientificSnapshot } from "../src/server/literature/guard";
import type { SuggestionCandidate, SuggestionProvider } from "../src/server/screening/applySuggestions";
import { CLAUDE_SCREENING_MODEL, CLAUDE_SCREENING_PROMPT_VERSION, chooseScreeningTransport, loadSeedKnowledge, suggestWithClaude } from "../src/server/screening/claude";
import { assertLocalDatabase, parseCompareArgs } from "../src/server/screening/cli";
import { renderComparisonMarkdown, summarizeComparison, type ComparisonRow } from "../src/server/screening/compare";
import { governingPurpose } from "../src/server/screening/deterministic";
import { loadBpaScreeningQueue } from "../src/server/screening/queue";
import { SCREENING_PURPOSES, type ScreeningPurposeName } from "../src/server/screening/reasons";
import { sortScreeningQueue } from "../src/server/screening/sample";

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
    process.env[key] ??= value;
  }
}

loadEnvFile(new URL("../.env", import.meta.url).pathname);

/// What the comparison needs per candidate. The queue loader produces it from the database; a
/// fixture file produces it for a run without a database. Abstracts are read and never written out.
type CompareInput = {
  sourceId: string;
  pmid: string | null;
  title: string;
  year: number | null;
  abstractText: string | null;
  retracted: boolean;
  publicationStatus: string | null;
  purposes: readonly ScreeningPurposeName[];
  windows: readonly string[];
  machineDecision: string | null;
  machineReason: string | null;
  machineConfidence: string | null;
  curatorDecision: string | null;
  curatorReasonCode: string | null;
};

function isPurpose(value: unknown): value is ScreeningPurposeName {
  return typeof value === "string" && (SCREENING_PURPOSES as readonly string[]).includes(value);
}

function readFixture(path: string): CompareInput[] {
  const raw: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) throw new Error("The fixture file must hold an array of candidates.");
  return raw.map((item: Record<string, unknown>, index) => {
    if (typeof item.title !== "string" || typeof item.sourceId !== "string") throw new Error(`Fixture row ${index} needs sourceId and title.`);
    const purposes = Array.isArray(item.purposes) ? item.purposes.filter(isPurpose) : [];
    return {
      sourceId: item.sourceId,
      pmid: typeof item.pmid === "string" ? item.pmid : null,
      title: item.title,
      year: typeof item.year === "number" ? item.year : null,
      abstractText: typeof item.abstractText === "string" ? item.abstractText : null,
      retracted: item.retracted === true,
      publicationStatus: typeof item.publicationStatus === "string" ? item.publicationStatus : "SCREENING_PENDING",
      purposes,
      windows: Array.isArray(item.windows) ? item.windows.filter((window): window is string => typeof window === "string") : ["relevance"],
      machineDecision: typeof item.machineDecision === "string" ? item.machineDecision : null,
      machineReason: typeof item.machineReason === "string" ? item.machineReason : null,
      machineConfidence: typeof item.machineConfidence === "string" ? item.machineConfidence : null,
      curatorDecision: typeof item.curatorDecision === "string" ? item.curatorDecision : null,
      curatorReasonCode: typeof item.curatorReasonCode === "string" ? item.curatorReasonCode : null,
    };
  });
}

function toCandidate(input: CompareInput): SuggestionCandidate {
  return {
    evidenceSourceId: input.sourceId,
    title: input.title,
    abstractText: input.abstractText,
    retracted: input.retracted,
    purposes: input.purposes,
    publicationStatus: input.publicationStatus,
  };
}

async function screenAll(inputs: readonly CompareInput[], provider: SuggestionProvider, concurrency: number): Promise<ComparisonRow[]> {
  const rows: ComparisonRow[] = new Array<ComparisonRow>(inputs.length);
  let next = 0;
  let done = 0;
  async function worker() {
    while (next < inputs.length) {
      const index = next++;
      const input = inputs[index];
      if (!input) continue;
      const base = {
        evidenceSourceId: input.sourceId,
        pmid: input.pmid,
        year: input.year,
        title: input.title,
        governingPurpose: governingPurpose(input.purposes),
        existing: input.machineDecision
          ? { decision: input.machineDecision, reasonCode: input.machineReason, confidence: input.machineConfidence }
          : null,
        curator: input.curatorDecision ? { decision: input.curatorDecision, reasonCode: input.curatorReasonCode } : null,
      };
      try {
        const model = await provider(toCandidate(input));
        rows[index] = { ...base, model, error: null };
        console.log(`${model.decision} ${model.reasonCode} ${model.confidence} ${input.year ?? "?"} pmid ${input.pmid ?? "-"} ${input.title}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rows[index] = { ...base, model: null, error: message };
        console.log(`ERROR ${input.year ?? "?"} pmid ${input.pmid ?? "-"} ${input.title}: ${message}`);
      }
      done += 1;
      if (done % 10 === 0) console.log(`${done} of ${inputs.length} screened`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker()));
  return rows;
}

async function main() {
  const command = parseCompareArgs(process.argv.slice(2));
  const transport = chooseScreeningTransport();
  const servedModels = new Set<string>();
  const provider = suggestWithClaude({
    transport,
    seedKnowledge: loadSeedKnowledge("bpa"),
    onServedModel: (model) => {
      if (model) servedModels.add(model);
    },
  });

  let inputs: CompareInput[];
  let source: string;
  let db: PrismaClient | null = null;
  let before: { snapshot: Awaited<ReturnType<typeof scientificSnapshot>>; decisions: number; latest: Date | null; sources: number; runs: number } | null = null;

  if (command.fromFile) {
    inputs = readFixture(command.fromFile);
    source = `fixture ${command.fromFile}`;
  } else {
    if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
    assertLocalDatabase(process.env.DATABASE_URL);
    db = new PrismaClient();
    before = {
      snapshot: await scientificSnapshot(db),
      decisions: await db.literatureScreeningDecision.count(),
      latest: (await db.literatureScreeningDecision.aggregate({ _max: { updatedAt: true } }))._max.updatedAt,
      sources: await db.evidenceSource.count(),
      runs: await db.curationAgentRun.count(),
    };
    const queue = await loadBpaScreeningQueue(db);
    inputs = queue.cards.filter((card) => card.publicationStatus !== "DUPLICATE");
    source = "the localhost BPA reproductive queue";
  }

  inputs = sortScreeningQueue(inputs);
  if (command.limit !== null) inputs = inputs.slice(0, command.limit);
  const withMachine = inputs.filter((input) => input.machineDecision).length;
  const withCurator = inputs.filter((input) => input.curatorDecision).length;
  console.log(`${CLAUDE_SCREENING_PROMPT_VERSION} ${CLAUDE_SCREENING_MODEL} via ${transport.name}`);
  console.log(`Dry run over ${inputs.length} candidates from ${source}: ${withMachine} with a stored machine suggestion, ${withCurator} with a curator decision.`);

  const rows = await screenAll(inputs, provider, command.concurrency);
  const summary = summarizeComparison(rows);
  const ranAt = new Date().toISOString();
  const markdown = renderComparisonMarkdown(summary, {
    promptVersion: CLAUDE_SCREENING_PROMPT_VERSION,
    model: CLAUDE_SCREENING_MODEL,
    servedModels: [...servedModels].sort(),
    transport: transport.name,
    source,
    ranAt,
  });

  if (db && before) {
    assertScientificSnapshotUnchanged(before.snapshot, await scientificSnapshot(db));
    const after = {
      decisions: await db.literatureScreeningDecision.count(),
      latest: (await db.literatureScreeningDecision.aggregate({ _max: { updatedAt: true } }))._max.updatedAt,
      sources: await db.evidenceSource.count(),
      runs: await db.curationAgentRun.count(),
    };
    if (
      after.decisions !== before.decisions ||
      after.sources !== before.sources ||
      after.runs !== before.runs ||
      `${after.latest?.toISOString()}` !== `${before.latest?.toISOString()}`
    ) {
      throw new Error("A screening decision, agent run or evidence source changed during a dry run. Investigate before trusting this report.");
    }
    await db.$disconnect();
  }

  const outFile = command.outFile ?? `docs/reports/screening-compare-${CLAUDE_SCREENING_PROMPT_VERSION}.md`;
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, markdown);
  const jsonFile = outFile.replace(/\.md$/, "") + ".json";
  writeFileSync(jsonFile, JSON.stringify({ promptVersion: CLAUDE_SCREENING_PROMPT_VERSION, model: CLAUDE_SCREENING_MODEL, transport: transport.name, source, ranAt, summary }, null, 2));

  const machine = summary.versusMachine;
  const curator = summary.versusCurator;
  console.log("");
  console.log(`Suggestions ${summary.screened} of ${summary.total}, errors ${summary.errors}.`);
  console.log(
    `Versus stored machine suggestions: decision ${machine.decisionAgree}/${machine.n}, reason ${machine.reasonAgree}/${machine.reasonComparable}, kappa ${machine.kappa === null ? "n/a" : machine.kappa.toFixed(2)}.`,
  );
  console.log(
    `Versus curator decisions: decision ${curator.decisionAgree}/${curator.n}, reason ${curator.reasonAgree}/${curator.reasonComparable}, kappa ${curator.kappa === null ? "n/a" : curator.kappa.toFixed(2)}.`,
  );
  console.log(`Report written to ${outFile} and ${jsonFile}. Nothing was written to the database.`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Comparison failed.";
  console.error(message);
  process.exit(1);
});
