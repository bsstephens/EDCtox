export type ScreeningProviderName = "deterministic" | "claude";

export type ScreeningCommand = {
  dryRun: boolean;
  limit: number;
  provider: ScreeningProviderName;
};

export type CompareCommand = {
  fromFile: string | null;
  outFile: string | null;
  limit: number | null;
  concurrency: number;
};

function argument(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

export function assertLocalDatabase(databaseUrl: string): void {
  let host = "";
  try {
    host = new URL(databaseUrl).hostname;
  } catch {
    throw new Error("Literature screening runs only against localhost.");
  }
  if (host !== "localhost" && host !== "127.0.0.1") {
    throw new Error("Literature screening runs only against localhost.");
  }
}

function assertBpaReproductive(argv: string[]): void {
  if (argv.includes("--all")) throw new Error("Refusing --all. Screening is BPA reproductive only.");
  if (argument(argv, "--compound") !== "bpa") throw new Error("Use --compound bpa.");
  if (argument(argv, "--domain") !== "reproductive") throw new Error("Use --domain reproductive.");
}

function parseProvider(argv: string[]): ScreeningProviderName {
  const provider = argument(argv, "--provider") ?? "deterministic";
  if (provider !== "deterministic" && provider !== "claude") throw new Error("Use --provider deterministic or --provider claude.");
  return provider;
}

export function parseScreeningArgs(argv: string[]): ScreeningCommand {
  assertBpaReproductive(argv);
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply-suggestions");
  if (dryRun === apply) throw new Error("Pass either --dry-run or --apply-suggestions.");
  if (!argv.includes("--pending")) throw new Error("Pass --pending. This command only suggests pending publications.");
  const limitText = argument(argv, "--limit") ?? "20";
  const limit = Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Use --limit from 1 to 20.");
  return { dryRun, limit, provider: parseProvider(argv) };
}

/// The comparison is a dry run by construction. It has no apply flag to parse.
export function parseCompareArgs(argv: string[]): CompareCommand {
  assertBpaReproductive(argv);
  if (argv.includes("--apply") || argv.includes("--apply-suggestions")) {
    throw new Error("The comparison never writes. Remove --apply.");
  }
  const limitText = argument(argv, "--limit");
  const limit = limitText === undefined ? null : Number(limitText);
  if (limit !== null && (!Number.isInteger(limit) || limit < 1 || limit > 200)) throw new Error("Use --limit from 1 to 200.");
  const concurrencyText = argument(argv, "--concurrency") ?? "4";
  const concurrency = Number(concurrencyText);
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) throw new Error("Use --concurrency from 1 to 8.");
  return {
    fromFile: argument(argv, "--from") ?? null,
    outFile: argument(argv, "--out") ?? null,
    limit,
    concurrency,
  };
}
