export type ClaimCommand = {
  dryRun: boolean;
  limit: number;
};

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
  if (argv.includes("--all")) throw new Error("Refusing --all. Claim extraction is the five-paper BPA pilot.");
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) throw new Error("Pass either --dry-run or --apply.");
  if (argument(argv, "--compound") !== "bpa") throw new Error("Use --compound bpa.");
  if (argument(argv, "--domain") !== "reproductive") throw new Error("Use --domain reproductive.");
  const limitText = argument(argv, "--limit") ?? "5";
  const limit = Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 5) throw new Error("Use --limit from 1 to 5.");
  return { dryRun, limit };
}
