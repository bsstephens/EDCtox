/**
 * Read each paper once and store what it is about. Layer 1 of docs/SCREENING_REDESIGN.md.
 *
 *   npm run literature:profile -- --dry-run --limit 5     builds prompts, calls nothing
 *   npm run literature:profile -- --apply --limit 5       calls the API and writes profiles
 *   npm run literature:profile -- --apply --transcript docs/ops/profiles.json   replays, no network
 *
 * One model call per paper, ever. A paper already profiled at the current prompt version is
 * skipped, so re-running is free. Nothing here writes a score, a finding, a screening decision,
 * or countsAsScientificEvidence.
 */
import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";

import { PrismaClient } from "../generated/prisma";
import {
  PROFILE_MODEL,
  PROFILE_PROMPT_VERSION,
  PROFILE_PROVIDER,
  apiCompletion,
  buildProfileRequest,
  createProfileClient,
  createProfiler,
  profileDisagreements,
  readProfileTranscript,
  transcriptCompletion,
  writeProfileTranscript,
  type ProfileCandidate,
  type ProfileTranscript,
} from "../src/server/literature/profile";
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

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

async function confirmApply(host: string, count: number, network: boolean) {
  const spend = network ? ` It makes ${count} API calls, which cost money.` : "";
  if (host.includes("localhost") || host.includes("127.0.0.1")) {
    if (!network) return;
    const prompt = createInterface({ input, output });
    const answer = await prompt.question(`${count} papers.${spend} Type apply to continue: `);
    prompt.close();
    if (answer.trim() !== "apply") {
      console.log("Stopped.");
      process.exit(1);
    }
    return;
  }
  const prompt = createInterface({ input, output });
  const answer = await prompt.question(`This writes profiles to ${host}.${spend} Type apply to continue: `);
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
  const limit = Number(argument("--limit") ?? "0") || undefined;
  const transcriptPath = argument("--transcript");
  const recordPath = argument("--record");
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }
  const host = new URL(process.env.DATABASE_URL).host;

  const db = new PrismaClient();
  try {
    const sources = await db.evidenceSource.findMany({
      where: {
        abstractText: { not: null },
        profiles: { none: { promptVersion: PROFILE_PROMPT_VERSION } },
      },
      select: {
        id: true,
        title: true,
        abstractText: true,
        year: true,
        journalOrPublisher: true,
        publicationTypes: true,
        meshDescriptors: true,
        meshSubstances: true,
        providerIndexedAt: true,
      },
      orderBy: { stableKey: "asc" },
      ...(limit ? { take: limit } : {}),
    });
    console.log(`${sources.length} publications have an abstract and no ${PROFILE_PROMPT_VERSION} profile.`);
    if (sources.length === 0) return;

    const candidates: ProfileCandidate[] = sources.map((source) => ({
      evidenceSourceId: source.id,
      title: source.title,
      abstractText: source.abstractText,
      year: source.year,
      journal: source.journalOrPublisher,
      facts: providerFacts({
        publicationTypes: source.publicationTypes,
        meshDescriptors: source.meshDescriptors,
        meshSubstances: source.meshSubstances,
        indexedAt: source.providerIndexedAt?.toISOString() ?? null,
      }),
    }));

    if (dryRun) {
      const sample = candidates[0];
      if (sample) {
        const request = buildProfileRequest(sample);
        console.log(`\nPrompt for "${sample.title.slice(0, 70)}" (sha ${request.promptSha256.slice(0, 12)}):\n`);
        console.log(request.user.split("\n").slice(0, 12).join("\n"));
      }
      const chars = candidates.reduce((sum, c) => sum + (c.abstractText?.length ?? 0), 0);
      console.log(
        `\nWould make ${candidates.length} calls to ${PROFILE_MODEL}.` +
          ` About ${Math.round((chars + candidates.length * 1800) / 4 / 1000)}k input tokens in total.`,
      );
      console.log("Dry run. No API call was made and nothing was written.");
      return;
    }

    const replaying = Boolean(transcriptPath);
    await confirmApply(host, candidates.length, !replaying);

    const transcript: ProfileTranscript = transcriptPath
      ? readProfileTranscript(transcriptPath)
      : { promptVersion: PROFILE_PROMPT_VERSION, entries: {} };
    const completion = replaying
      ? transcriptCompletion(transcript)
      : apiCompletion(createProfileClient(process.env.ANTHROPIC_API_KEY));

    const profiler = createProfiler({
      completion,
      onAnswer: (request, raw) => {
        if (!recordPath) return;
        transcript.entries[request.evidenceSourceId] = {
          title: request.title,
          promptSha256: request.promptSha256,
          model: PROFILE_MODEL,
          response: raw,
          recordedAt: new Date().toISOString(),
        };
      },
    });

    let written = 0;
    let flagged = 0;
    const failures: string[] = [];

    for (const candidate of candidates) {
      try {
        const profile = await profiler(candidate);
        const request = buildProfileRequest(candidate);
        const flags = profileDisagreements(profile, candidate.facts);
        if (flags.length > 0) flagged += 1;

        await db.paperProfile.upsert({
          where: {
            evidenceSourceId_promptVersion: {
              evidenceSourceId: candidate.evidenceSourceId,
              promptVersion: PROFILE_PROMPT_VERSION,
            },
          },
          update: { ...profile, model: PROFILE_MODEL, promptSha256: request.promptSha256 },
          create: {
            evidenceSourceId: candidate.evidenceSourceId,
            promptVersion: PROFILE_PROMPT_VERSION,
            model: PROFILE_MODEL,
            promptSha256: request.promptSha256,
            ...profile,
          },
        });
        written += 1;
        console.log(
          `  ${candidate.title.slice(0, 54).padEnd(54)} ` +
            `${profile.compoundsStudied.slice(0, 2).join(", ").slice(0, 28).padEnd(28)} ` +
            `${profile.measuresOutcome ? "outcome" : "exposure only"}` +
            (flags.length > 0 ? `  FLAG: ${flags.map((f) => f.field).join(",")}` : ""),
        );
      } catch (error) {
        failures.push(`${candidate.title.slice(0, 60)}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    if (recordPath) writeProfileTranscript(recordPath, transcript);
    console.log(
      `\nWrote ${written} profiles with ${PROFILE_PROVIDER}/${PROFILE_MODEL}.` +
        ` ${flagged} disagree with the provider indexing and are worth a look.` +
        (failures.length > 0 ? ` ${failures.length} failed.` : ""),
    );
    for (const failure of failures) console.log(`  failed: ${failure}`);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
