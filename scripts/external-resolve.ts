import { createInterface } from "node:readline/promises";
import { existsSync, readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";

import { PrismaClient } from "../generated/prisma";
import { applyIdentityPlans, type IdentityWriteClient } from "../src/server/external/applyIdentity";
import { resolveCompoundIdentity } from "../src/server/external/resolveCompound";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(new URL("../.env", import.meta.url).pathname);

const ALLOWED = new Set(["bpa", "dehp", "pfos"]);

function argument(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

async function confirmApply(host: string) {
  if (host.includes("localhost") || host.includes("127.0.0.1")) return;
  const prompt = createInterface({ input, output });
  const answer = await prompt.question(`This writes to ${host}. Type apply to continue: `);
  prompt.close();
  if (answer.trim() !== "apply") {
    console.log("Stopped.");
    process.exit(1);
  }
}

async function main() {
  if (process.argv.includes("--all")) {
    console.error("Refusing --all. Name bpa, dehp, or pfos.");
    process.exit(1);
  }
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  if (dryRun === apply) {
    console.error("Pass either --dry-run or --apply.");
    process.exit(1);
  }
  const requested = argument("--compound")
    ?.split(",")
    .map((slug) => slug.trim())
    .filter(Boolean);
  if (!requested?.length || requested.some((slug) => !ALLOWED.has(slug))) {
    console.error("Use --compound bpa, --compound dehp, --compound pfos, or a comma-separated list of those three.");
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
    for (const slug of requested) {
      const compound = await db.compound.findUnique({ where: { slug } });
      if (!compound) throw new Error(`Compound ${slug} is not in the database.`);
      const plans = await resolveCompoundIdentity(
        {
          slug: compound.slug,
          canonicalName: compound.canonicalName,
          casNumber: compound.casNumber,
          molecularFormula: compound.molecularFormula,
          inchi: compound.inchi,
          inchiKey: compound.inchiKey,
          canonicalSmiles: compound.canonicalSmiles,
          pubChemCid: compound.pubChemCid,
          molarMass: compound.molarMass?.toString() ?? null,
        },
        { epaApiKey: process.env.EPA_CTX_API_KEY },
      );

      console.log(`\n${slug} (${dryRun ? "dry run" : "apply"})`);
      for (const plan of plans) {
        console.log(`  ${plan.providerCode} ${plan.status}${plan.skipped ? " (not queried)" : ""}`);
        console.log(`  ${plan.reason}`);
        for (const decision of plan.fieldDecisions) {
          if (decision.action === "keep" && decision.localValue === decision.incomingValue) continue;
          console.log(`  ${decision.action} ${decision.field}`);
        }
      }

      if (apply) {
        const before = await db.mechanismAssessment.count();
        const result = await applyIdentityPlans(db as unknown as IdentityWriteClient, compound, plans);
        const after = await db.mechanismAssessment.count();
        if (before !== after) throw new Error("Identity resolution changed mechanism assessments.");
        console.log(`  wrote ${result.identifiersWritten} new identifiers; runs ${result.runIds.join(", ")}`);
      }
    }
  } finally {
    await db.$disconnect();
  }
}

await main();
