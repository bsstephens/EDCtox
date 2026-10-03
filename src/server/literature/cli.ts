import {
  LITERATURE_PROVIDERS,
  LITERATURE_PURPOSES,
  type LiteratureProviderName,
  type LiteraturePurposeName,
} from "./queries";

const PURPOSE_FLAGS: Record<string, LiteraturePurposeName> = {
  "systematic-reviews": "SYSTEMATIC_REVIEWS",
  "human-reproductive": "HUMAN_REPRODUCTIVE",
  contradictory: "CONTRADICTORY_OR_NULL",
};

const PROVIDER_FLAGS: Record<string, LiteratureProviderName> = {
  pubmed: "PUBMED",
  "europe-pmc": "EUROPE_PMC",
};

function argument(argv: string[], name: string): string | undefined {
  const index = argv.indexOf(name);
  if (index === -1) return undefined;
  return argv[index + 1];
}

export type LiteratureCommand = {
  dryRun: boolean;
  purposes: LiteraturePurposeName[];
  providers: LiteratureProviderName[];
};

export function parseLiteratureArgs(argv: string[]): LiteratureCommand {
  if (argv.includes("--all")) {
    throw new Error("Refusing --all. Phase 3A searches BPA only.");
  }
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  if (dryRun === apply) throw new Error("Pass either --dry-run or --apply.");

  const compound = argument(argv, "--compound");
  if (compound !== "bpa") throw new Error("Use --compound bpa. Phase 3A does not search other compounds.");

  const domain = argument(argv, "--domain");
  if (domain !== "reproductive") {
    throw new Error("Use --domain reproductive. Phase 3A does not search other domains.");
  }

  const allPurposes = argv.includes("--all-purposes");
  const purposeFlag = argument(argv, "--purpose");
  if (allPurposes === Boolean(purposeFlag)) {
    throw new Error("Pass --all-purposes or one --purpose systematic-reviews, human-reproductive, or contradictory.");
  }
  const purposes = allPurposes
    ? [...LITERATURE_PURPOSES]
    : [PURPOSE_FLAGS[purposeFlag ?? ""]].filter((purpose): purpose is LiteraturePurposeName => Boolean(purpose));
  if (purposes.length === 0) {
    throw new Error("Unknown --purpose. Use systematic-reviews, human-reproductive, or contradictory.");
  }

  const providerFlag = argument(argv, "--provider");
  const providers = providerFlag
    ? [PROVIDER_FLAGS[providerFlag]].filter((provider): provider is LiteratureProviderName => Boolean(provider))
    : [...LITERATURE_PROVIDERS];
  if (providerFlag && providers.length === 0) {
    throw new Error("Unknown --provider. Use pubmed or europe-pmc.");
  }

  return { dryRun, purposes, providers };
}
