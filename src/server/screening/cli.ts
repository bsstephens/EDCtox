export type ScreeningCommand = {
  dryRun: boolean;
  limit: number;
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

export function parseScreeningArgs(argv: string[]): ScreeningCommand {
  if (argv.includes("--all")) throw new Error("Refusing --all. Screening is BPA reproductive only.");
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply-suggestions");
  if (dryRun === apply) throw new Error("Pass either --dry-run or --apply-suggestions.");
  if (argument(argv, "--compound") !== "bpa") throw new Error("Use --compound bpa.");
  if (argument(argv, "--domain") !== "reproductive") throw new Error("Use --domain reproductive.");
  if (!argv.includes("--pending")) throw new Error("Pass --pending. This command only suggests pending publications.");
  const limitText = argument(argv, "--limit") ?? "20";
  const limit = Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Use --limit from 1 to 20.");
  return { dryRun, limit };
}
