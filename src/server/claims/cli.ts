export type ClaimCommand = {
  dryRun: boolean;
  limit: number;
  /**
   * "pilot" is the five hand-picked abstracts. "included" is every BPA reproductive paper the
   * screener included, which is the same compound and the same domain, so the scientific scope
   * does not widen: only the number of papers does.
   */
  cohort: "pilot" | "included";
  /** The rule-based extractor stays the default, so a model run is always asked for explicitly. */
  extractor: "deterministic" | "claude";
  /** Papers to read before stopping, so a long run can be inspected before it is trusted. */
  inspect: number | null;
  transcriptPath: string | undefined;
  recordPath: string | undefined;
  /**
   * Specific papers to re-read, as PMIDs, within the chosen cohort. For repairing or revisiting
   * a handful of papers after a prompt or ontology change without paying to read the rest.
   */
  pmids: readonly string[];
};

/** The included cohort is larger than the pilot but still one compound and one domain. */
const MAX_INCLUDED = 60;

function argument(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

export function assertClaimDatabase(databaseUrl: string): void {
  let host = "";
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("Claim extraction runs only against localhost.");
  }
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("Claim extraction runs only against localhost.");
  }
}

export function parseClaimArgs(argv: string[]): ClaimCommand {
  // Still refused. --all would mean every compound and every domain, which is a change of
  // scientific scope, not a bigger run of the same one.
  if (argv.includes("--all")) throw new Error("Refusing --all. Pass --cohort included for the BPA reproductive set.");
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) throw new Error("Pass either --dry-run or --apply.");
  if (argument(argv, "--compound") !== "bpa") throw new Error("Use --compound bpa.");
  if (argument(argv, "--domain") !== "reproductive") throw new Error("Use --domain reproductive.");

  const cohortText = argument(argv, "--cohort") ?? "pilot";
  if (cohortText !== "pilot" && cohortText !== "included") throw new Error("Use --cohort pilot or --cohort included.");
  const cohort = cohortText;

  const extractorText = argument(argv, "--extractor") ?? "deterministic";
  if (extractorText !== "deterministic" && extractorText !== "claude") {
    throw new Error("Use --extractor deterministic or --extractor claude.");
  }

  const ceiling = cohort === "pilot" ? 5 : MAX_INCLUDED;
  const limitText = argument(argv, "--limit") ?? String(cohort === "pilot" ? 5 : MAX_INCLUDED);
  const limit = Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > ceiling) throw new Error(`Use --limit from 1 to ${ceiling}.`);

  const inspectText = argument(argv, "--inspect");
  const inspect = inspectText === undefined ? null : Number(inspectText);
  if (inspect !== null && (!Number.isInteger(inspect) || inspect < 1)) throw new Error("Use --inspect with a count.");
  if (inspect !== null && apply) throw new Error("--inspect reads without writing, so pass it with --dry-run.");

  const pmidText = argument(argv, "--pmids");
  const pmids = pmidText ? pmidText.split(",").map((value) => value.trim()).filter(Boolean) : [];
  if (pmidText !== undefined && pmids.length === 0) throw new Error("Use --pmids with a comma-separated list.");
  if (pmids.some((value) => !/^\d+$/.test(value))) throw new Error("A PMID is digits only.");

  return {
    dryRun,
    limit,
    cohort,
    extractor: extractorText,
    inspect,
    transcriptPath: argument(argv, "--transcript"),
    recordPath: argument(argv, "--record"),
    pmids,
  };
}
