import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { applyLiteratureRun, recordCompoundSearched, type LiteratureStore } from "./applyCandidates";
import { plainText } from "./entities";
import { parseLiteratureArgs } from "./cli";
import { normalizeDoi, normalizePmid, normalizeTitle, planLiteratureHits, type ExistingSource, type IncomingPaper, type PlannedHit } from "./dedup";
import { parseEuropePmcSearch } from "./parseEuropePmc";
import { parseEsearch, parsePubmedArticles } from "./parsePubmed";
import { assessReproductiveRelevance } from "./relevance";
import { capNewInserts } from "./runSearch";
import {
  BPA_REPRODUCTIVE_SCOPE,
  EUROPE_PMC_UNIQUE_CAP,
  EUROPE_PMC_WINDOW_CAP,
  PUBMED_RECENT_CAP,
  PUBMED_RELEVANCE_CAP,
  buildBpaReproductiveQuery,
  LITERATURE_QUERY_VERSION,
  assertBpaReproductiveTarget,
} from "./queries";

const QUERY_HASHES = {
  "PUBMED SYSTEMATIC_REVIEWS": "08f2446f2fdfebebf1361d802d9ef8d275e5c5e9babec649e7beb53161cd59a7",
  "EUROPE_PMC SYSTEMATIC_REVIEWS": "5c99a007b8880f8c8fdd998f4c281170400d2264c03161722b3403a4f3e7f736",
  "PUBMED HUMAN_REPRODUCTIVE": "b906dfa593c8ea893d0b424324e489f5b1c01968ee962b8fdc61034cf6b1333c",
  "EUROPE_PMC HUMAN_REPRODUCTIVE": "657e615c7ccfb82acad113db3db0163178e968d5cc81d0f70760773db4fac4af",
  "PUBMED CONTRADICTORY_OR_NULL": "1b208eb0e45d12b4e53e8c5d1ab9eb0a80ca26fc82ffbcb7d464313f9b92d7c9",
  "EUROPE_PMC CONTRADICTORY_OR_NULL": "7a136c05af9f0e9a1124aeecb997262584ab1281828f20760d2a18be72322570",
} as const;

const WRITE_PATH = [
  "src/server/literature/queries.ts",
  "src/server/literature/dedup.ts",
  "src/server/literature/applyCandidates.ts",
  "src/server/literature/runSearch.ts",
  "src/server/literature/remote.ts",
  "src/server/literature/entities.ts",
  "src/server/literature/relevance.ts",
  "src/server/literature/parsePubmed.ts",
  "src/server/literature/parseEuropePmc.ts",
  "src/server/literature/cli.ts",
  "scripts/literature-search.ts",
];

function read(path: string): string {
  return readFileSync(path, "utf8");
}

function walk(dir: string): string[] {
  const files: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) files.push(path);
  }
  return files;
}

function paper(overrides: Partial<IncomingPaper> = {}): IncomingPaper {
  return {
    doi: "10.1000/example",
    pmid: "100",
    pmcid: null,
    title: "Example title",
    authors: "Ada",
    journal: "Journal",
    year: 2020,
    abstractText: "Internal abstract.",
    openAccess: null,
    retracted: false,
    url: "https://pubmed.ncbi.nlm.nih.gov/100/",
    ...overrides,
  };
}

function memoryStore() {
  const calls: Array<{ model: string; data: Record<string, unknown> }> = [];
  let sourceCount = 0;
  const store: LiteratureStore = {
    literatureSearchRun: {
      async create(args) {
        calls.push({ model: "run", data: args.data });
        return { id: "run-1" };
      },
    },
    literatureSearchHit: {
      async create(args) {
        calls.push({ model: "hit", data: args.data });
        return { id: "hit-1" };
      },
    },
    evidenceSource: {
      async create(args) {
        sourceCount += 1;
        calls.push({ model: "source", data: args.data });
        return { id: `source-${sourceCount}` };
      },
      async update(args) {
        calls.push({ model: "source-update", data: args.data });
        return {};
      },
    },
    compound: {
      async update(args) {
        calls.push({ model: "compound", data: args.data });
        return {};
      },
    },
  };
  return { calls, store };
}

test("versioned BPA reproductive queries stay separated", () => {
  const purposes = ["SYSTEMATIC_REVIEWS", "HUMAN_REPRODUCTIVE", "CONTRADICTORY_OR_NULL"] as const;
  const providers = ["PUBMED", "EUROPE_PMC"] as const;
  const queries = purposes.flatMap((purpose) =>
    providers.map((provider) => {
      const built = buildBpaReproductiveQuery(purpose, provider);
      assert.equal(built.version, LITERATURE_QUERY_VERSION);
      assert.equal(built.version, "bpa-reproductive-v2");
      const hash = createHash("sha256").update(built.query).digest("hex");
      assert.equal(hash, QUERY_HASHES[`${provider} ${purpose}`]);
      return built.query;
    }),
  );
  assert.equal(new Set(queries).size, 6);

  const review = buildBpaReproductiveQuery("SYSTEMATIC_REVIEWS", "PUBMED").query;
  const human = buildBpaReproductiveQuery("HUMAN_REPRODUCTIVE", "PUBMED").query;
  const contradictory = buildBpaReproductiveQuery("CONTRADICTORY_OR_NULL", "PUBMED").query;
  assert.equal(review.includes("no association"), false);
  assert.equal(human.includes("no association"), false);
  assert.equal(human.includes("humans[MeSH Terms]"), true);
  assert.equal(contradictory.includes("systematic review[Publication Type]"), false);
  assert.equal(contradictory.includes("null finding"), true);
  assert.equal(PUBMED_RELEVANCE_CAP, 15);
  assert.equal(PUBMED_RECENT_CAP, 10);
  assert.equal(EUROPE_PMC_WINDOW_CAP, 10);
  assert.equal(EUROPE_PMC_UNIQUE_CAP, 10);
  const europeReview = buildBpaReproductiveQuery("SYSTEMATIC_REVIEWS", "EUROPE_PMC").query;
  assert.equal(europeReview.includes('TITLE:"Bisphenol A"'), true);
  assert.equal(europeReview.includes('ABSTRACT:"Bisphenol A"'), true);
  assert.equal(europeReview.includes("(SRC:MED OR SRC:PMC)"), true);
  const europeNull = buildBpaReproductiveQuery("CONTRADICTORY_OR_NULL", "EUROPE_PMC").query;
  assert.equal(europeNull.includes('TITLE:"no association"'), true);
  assert.equal(europeNull.includes("systematic review"), false);

  const seed = read("src/data/seeds/compounds.ts");
  assert.equal(seed.includes(BPA_REPRODUCTIVE_SCOPE.iupacName), true);
  assert.equal(seed.includes('canonicalName: "Bisphenol A"'), true);
  assert.equal(seed.includes('casNumber: "80-05-7"'), true);
  assertBpaReproductiveTarget({
    slug: "bpa",
    canonicalName: "Bisphenol A",
    displayName: "BPA",
    casNumber: "80-05-7",
    aliasNames: [BPA_REPRODUCTIVE_SCOPE.iupacName],
  });
  assert.throws(() =>
    assertBpaReproductiveTarget({
      slug: "dehp",
      canonicalName: "Bis(2-ethylhexyl) phthalate",
      displayName: "DEHP",
      casNumber: "117-81-7",
      aliasNames: [],
    }),
  );
});

test("deduplicates DOI, then PMID, then title and year, and does not merge conflicts", () => {
  assert.equal(normalizeDoi("https://doi.org/10.1000/ABC"), "10.1000/abc");
  assert.equal(normalizePmid("PMID: 000123"), "123");
  assert.equal(normalizeTitle("Bisphenol A, and ovarian reserve."), "bisphenol a and ovarian reserve");

  const existing: ExistingSource[] = [
    { id: "doi-row", doi: "10.1000/abc", pmid: "1", title: "First paper", year: 2020 },
    { id: "pmid-row", doi: null, pmid: "2", title: "Second paper", year: 2021 },
  ];
  const doiDup = planLiteratureHits(existing, [paper({ doi: "DOI:10.1000/ABC", pmid: "1", title: "Different title", year: 1999 })]);
  assert.equal(doiDup[0]?.disposition, "DUPLICATE");
  assert.equal(doiDup[0]?.matchedSourceId, "doi-row");

  const pmidDup = planLiteratureHits(existing, [paper({ doi: null, pmid: "2", title: "Another title", year: 2010 })]);
  assert.equal(pmidDup[0]?.disposition, "DUPLICATE");
  assert.equal(pmidDup[0]?.matchedSourceId, "pmid-row");

  const titleDup = planLiteratureHits(existing, [
    paper({ doi: null, pmid: null, title: "First paper.", year: 2020 }),
  ]);
  assert.equal(titleDup[0]?.disposition, "DUPLICATE");
  assert.equal(titleDup[0]?.matchedSourceId, "doi-row");

  const conflict = planLiteratureHits(existing, [paper({ doi: "10.1000/abc", pmid: "2", title: "Split identity", year: 2022 })]);
  assert.equal(conflict[0]?.disposition, "CONFLICT");
  assert.equal(conflict[0]?.matchedSourceId, null);

  const titleConflict = planLiteratureHits(existing, [
    paper({ doi: "10.9999/other", pmid: "9", title: "First paper", year: 2020 }),
  ]);
  assert.equal(titleConflict[0]?.disposition, "CONFLICT");

  const batch = planLiteratureHits(
    [],
    [
      paper({ doi: "10.1000/new", pmid: "50", title: "New paper", year: 2022 }),
      paper({ doi: "https://doi.org/10.1000/new", pmid: "50", title: "New paper", year: 2022 }),
    ],
  );
  assert.equal(batch[0]?.disposition, "INSERTED");
  assert.equal(batch[1]?.disposition, "DUPLICATE");

  const skipped = planLiteratureHits([], [paper({ year: null })]);
  assert.equal(skipped[0]?.disposition, "SKIPPED");
});

test("saved PubMed and Europe PMC responses become candidate papers", () => {
  const esearch = parseEsearch(JSON.parse(read("src/server/literature/fixtures/pubmed-esearch.json")));
  assert.deepEqual(esearch.ids, ["31100001"]);
  const pubmed = parsePubmedArticles(read("src/server/literature/fixtures/pubmed-efetch.xml"));
  assert.equal(pubmed.length, 1);
  assert.equal(pubmed[0]?.pmid, "31100001");
  assert.equal(pubmed[0]?.doi, "10.1289/ehp.31100001");
  assert.equal(pubmed[0]?.year, 2019);
  assert.equal(pubmed[0]?.abstractText, "Internal abstract from PubMed.");
  assert.equal(pubmed[0]?.retracted, false);
  assert.equal(plainText("PM&#x2082;.&#x2085; and &lt;i&gt;Gaultheria&lt;/i&gt;"), "PM₂.₅ and Gaultheria");

  const retracted = parsePubmedArticles(`
    <PubmedArticleSet><PubmedArticle><MedlineCitation><PMID>4</PMID><Article>
      <Journal><Title>Journal</Title><JournalIssue><PubDate><Year>2020</Year></PubDate></JournalIssue></Journal>
      <ArticleTitle>Retraction: Example.</ArticleTitle>
      <PublicationType>Retracted Publication</PublicationType>
    </Article></MedlineCitation></PubmedArticle></PubmedArticleSet>
  `);
  assert.equal(retracted[0]?.retracted, true);

  const europe = parseEuropePmcSearch(JSON.parse(read("src/server/literature/fixtures/europepmc-search.json")));
  assert.equal(europe.count, 2);
  assert.equal(europe.papers[1]?.abstractText, "Internal abstract from Europe PMC.");
  assert.equal(europe.papers[0]?.openAccess, true);
});

test("a failed search writes a run and does not write sources", async () => {
  const { calls, store } = memoryStore();
  await applyLiteratureRun(store, {
    compoundId: "compound-1",
    provider: "PUBMED",
    purpose: "SYSTEMATIC_REVIEWS",
    queryText: "secret-query",
    resultWindow: "relevance",
    sortMode: "relevance",
    startedAt: new Date("2026-10-03T00:00:00Z"),
    completedAt: new Date("2026-10-03T00:00:01Z"),
    providerReportedCount: null,
    status: "FAILED",
    errorText: "PubMed unavailable",
    hits: planLiteratureHits([], [paper()]),
  });
  assert.equal(calls.some((call) => call.model === "source"), false);
  assert.equal(calls.some((call) => call.model === "hit"), false);
  const run = calls.find((call) => call.model === "run");
  assert.equal(run?.data.status, "FAILED");
  assert.equal(run?.data.errorText, "PubMed unavailable");
  assert.equal(run?.data.insertedCount, 0);
});

test("apply stores screening candidates and does not queue retracted papers as included", async () => {
  const { calls, store } = memoryStore();
  const hits = planLiteratureHits([], [
    paper({ pmid: "10", doi: "10.1000/a", retracted: false, abstractText: "Keep internally." }),
    paper({ pmid: "11", doi: "10.1000/b", title: "Retracted paper", retracted: true, year: 2018 }),
  ]);
  await applyLiteratureRun(store, {
    compoundId: "compound-1",
    provider: "PUBMED",
    purpose: "HUMAN_REPRODUCTIVE",
    queryText: "query",
    resultWindow: "relevance",
    sortMode: "relevance",
    startedAt: new Date("2026-10-03T00:00:00Z"),
    completedAt: new Date("2026-10-03T00:00:01Z"),
    providerReportedCount: 2,
    status: "SUCCEEDED",
    errorText: null,
    hits,
  });
  const sources = calls.filter((call) => call.model === "source").map((call) => call.data);
  assert.equal(sources.length, 2);
  assert.equal(sources.every((source) => source.countsAsScientificEvidence === false), true);
  assert.equal(sources.every((source) => source.sourceType === "UNSPECIFIED"), true);
  assert.equal(sources[0]?.publicationStatus, "SCREENING_PENDING");
  assert.equal(sources[0]?.abstractText, "Keep internally.");
  assert.equal(sources[1]?.publicationStatus, "RETRACTED");
  assert.equal(sources[1]?.retracted, true);
  assert.equal(sources.some((source) => source.publicationStatus === "INCLUDED"), false);
  assert.equal(sources.some((source) => source.publicationStatus === "DISCOVERED"), false);
});

test("search curation does not downgrade a curated compound", async () => {
  const { calls, store } = memoryStore();
  await recordCompoundSearched(store, "compound-1", "SCORES_CURATED", new Date("2026-10-03T00:00:00Z"));
  await recordCompoundSearched(store, "compound-1", "UNREVIEWED", new Date("2026-10-03T00:00:00Z"));
  assert.equal(calls[0]?.data.curationStatus, undefined);
  assert.equal(calls[1]?.data.curationStatus, "EVIDENCE_GATHERING");
  assert.ok(calls[0]?.data.lastEvidenceSearchAt instanceof Date);
});

test("fixture search inserts candidates, deduplicates providers, and cannot reach assessment writers", async () => {
  const { runBpaReproductiveSearch } = await import("./runSearch");
  const { calls, store } = memoryStore();
  const guarded = new Proxy(store, {
    get(target, prop) {
      const name = String(prop);
      if (name === "then") return undefined;
      if (!["literatureSearchRun", "literatureSearchHit", "evidenceSource", "compound"].includes(name)) {
        throw new Error(`forbidden write ${name}`);
      }
      return target[name as keyof LiteratureStore];
    },
  });
  const esearch = read("src/server/literature/fixtures/pubmed-esearch.json");
  const xml = read("src/server/literature/fixtures/pubmed-efetch.xml");
  const europe = read("src/server/literature/fixtures/europepmc-search.json");
  const urls: string[] = [];
  const fetchImpl = (async (url: string | URL | Request) => {
    let href = "";
    if (typeof url === "string") href = url;
    else if (url instanceof URL) href = url.href;
    else href = url.url;
    urls.push(href);
    if (href.includes("esearch.fcgi")) return new Response(esearch, { status: 200 });
    if (href.includes("efetch.fcgi")) return new Response(xml, { status: 200 });
    if (href.includes("europepmc")) return new Response(europe, { status: 200 });
    return new Response("missing", { status: 404 });
  }) as typeof fetch;

  const reports = await runBpaReproductiveSearch({
    compound: { id: "compound-1", curationStatus: "UNREVIEWED" },
    purposes: ["SYSTEMATIC_REVIEWS"],
    providers: ["PUBMED", "EUROPE_PMC"],
    existing: [],
    dryRun: false,
    store: guarded,
    fetchImpl,
    sleep: () => Promise.resolve(),
    now: new Date("2026-10-03T00:00:00Z"),
    ncbiApiKey: "SECRETKEY",
  });

  assert.equal(urls.some((url) => url.includes("retmax=15")), true);
  assert.equal(urls.some((url) => url.includes("retmax=10")), true);
  assert.equal(urls.some((url) => url.includes("sort=relevance")), true);
  assert.equal(urls.some((url) => url.includes("sort=pub_date")), true);
  assert.equal(urls.some((url) => url.includes("TITLE%3A") || url.includes("TITLE:")), true);
  assert.equal(urls.some((url) => url.includes("SECRETKEY")), true);
  assert.equal(JSON.stringify(calls).includes("SECRETKEY"), false);
  const pubmedRelevance = reports.find((report) => report.provider === "PUBMED" && report.resultWindow === "relevance");
  const europeRelevance = reports.find((report) => report.provider === "EUROPE_PMC" && report.resultWindow === "relevance");
  assert.equal(pubmedRelevance?.status, "SUCCEEDED");
  assert.equal(pubmedRelevance?.insertedCount, 1);
  assert.equal(europeRelevance?.duplicateCount, 1);
  assert.equal(europeRelevance?.insertedCount, 1);
  const sources = calls.filter((call) => call.model === "source");
  assert.equal(sources.length, 2);
  assert.equal(sources.every((call) => call.data.countsAsScientificEvidence === false), true);
  const enrichment = calls.find((call) => call.model === "source-update");
  assert.deepEqual(enrichment?.data, { openAccess: true });
  assert.equal(calls.some((call) => call.model === "compound" && call.data.curationStatus === "EVIDENCE_GATHERING"), true);
  assert.equal(calls.some((call) => !["run", "hit", "source", "source-update", "compound"].includes(call.model)), false);
});

test("relevance gate rejects obvious noise and keeps reproductive bisphenol papers", () => {
  const noise = [
    ["Obesity and cardiovascular disease", "Weight management and blood pressure in adults."],
    ["Clinical performance of bulk-fill composite restorations", "A randomized dental composite trial."],
    ["Gut microbiota signatures in primary aldosteronism", "An aldosterone-degrading gut bacterium."],
    ["Foliar treatment modulates redox signaling in wheat", "Tellurite-stressed Triticum aestivum roots."],
    ["Nanomaterials in radiation-induced disease", "Therapeutic promise of generic nanomaterials."],
  ] as const;
  for (const [title, abstractText] of noise) {
    const decision = assessReproductiveRelevance(paper({ title, abstractText }));
    assert.equal(decision.pass, false, title);
  }
  const keep = [
    ["Bisphenol A and polycystic ovary syndrome", "Ovarian morphology and testosterone were reviewed."],
    ["Bisphenol A exposure and in vitro fertilization outcomes", "Fertility clinic outcomes."],
    ["BPA and sperm quality", "Bisphenol A (BPA) and semen parameters."],
    ["Urinary bisphenol A and sex hormones", "Estradiol and testosterone in adults."],
    ["Bisphenol A induces apoptosis in human ovarian granulosa cells", "Steroidogenesis in granulosa cells."],
    ["Bisphenol A reproductive toxicity", "Fertility was reduced."],
  ] as const;
  for (const [title, abstractText] of keep) {
    assert.equal(assessReproductiveRelevance(paper({ title, abstractText })).pass, true, title);
  }
  const acronym = assessReproductiveRelevance(
    paper({
      title: "BPA quarterly processing and sperm bank logistics",
      abstractText: "The BPA unit handled stored samples.",
    }),
  );
  assert.equal(acronym.skipReason, "relevance-acronym");
  const cas = assessReproductiveRelevance(
    paper({
      title: "CAS 80-05-7 and ovarian function",
      abstractText: "Steroidogenesis changed.",
    }),
  );
  assert.equal(cas.pass, true);
});

test("Europe PMC unique cap does not drop duplicates", () => {
  const hits: PlannedHit[] = [1, 2, 3].map((n) => ({
    disposition: "INSERTED" as const,
    detail: "New candidate source.",
    stableKey: `lit:pmid:${n}`,
    matchedSourceId: null,
    paper: paper({ pmid: String(n), title: `Bisphenol A and sperm quality ${n}`, abstractText: "Bisphenol A and semen." }),
    enrichment: null,
    skipReason: null,
    studySignal: null,
  }));
  const first = hits[0];
  if (!first) throw new Error("Expected a capped hit.");
  hits.push({
    ...first,
    disposition: "DUPLICATE",
    stableKey: null,
    matchedSourceId: "existing",
  });
  const capped = capNewInserts(hits, 2);
  assert.equal(capped.used, 2);
  assert.equal(capped.hits.filter((hit) => hit.disposition === "INSERTED").length, 2);
  assert.equal(capped.hits.filter((hit) => hit.skipReason === "provider-cap").length, 1);
  assert.equal(capped.hits.filter((hit) => hit.disposition === "DUPLICATE").length, 1);
});

test("command parsing stays on BPA reproductive", () => {
  assert.throws(() => parseLiteratureArgs(["--all", "--dry-run"]));
  assert.throws(() => parseLiteratureArgs(["--compound", "dehp", "--domain", "reproductive", "--all-purposes", "--dry-run"]));
  assert.throws(() => parseLiteratureArgs(["--compound", "bpa", "--domain", "immune", "--all-purposes", "--dry-run"]));
  const command = parseLiteratureArgs(["--compound", "bpa", "--domain", "reproductive", "--all-purposes", "--dry-run"]);
  assert.equal(command.dryRun, true);
  assert.deepEqual(command.purposes, ["SYSTEMATIC_REVIEWS", "HUMAN_REPRODUCTIVE", "CONTRADICTORY_OR_NULL"]);
  assert.deepEqual(command.providers, ["PUBMED", "EUROPE_PMC"]);
});

test("publication status includes a screening step and search code cannot write findings", () => {
  const schema = read("prisma/schema.prisma");
  assert.match(
    schema,
    /enum PublicationCurationStatus \{[^}]*DISCOVERED[^}]*SCREENING_PENDING[^}]*INCLUDED[^}]*EXCLUDED[^}]*DUPLICATE[^}]*RETRACTED/s,
  );
  assert.match(schema, /model LiteratureSearchRun \{[\s\S]*queryVersion[\s\S]*errorText/);
  for (const path of WRITE_PATH) {
    const source = read(path);
    assert.equal(source.includes("evidenceFinding"), false, path);
    assert.equal(source.includes("mechanismAssessment"), false, path);
    assert.equal(source.includes("compoundOutcomeAssessment"), false, path);
  }
  const guard = read("src/server/literature/guard.ts");
  assert.match(guard, /mechanismAssessment\.findMany/);
  assert.doesNotMatch(guard, /mechanismAssessment\s*\.\s*(update|create|delete|upsert|updateMany|deleteMany)/);
  assert.doesNotMatch(guard, /evidenceFinding\s*\.\s*(update|create|delete|upsert|updateMany|deleteMany)/);
  assert.doesNotMatch(guard, /compoundOutcomeAssessment\s*\.\s*(update|create|delete|upsert|updateMany|deleteMany)/);

  for (const path of walk("src/app")) {
    const source = read(path);
    if (!path.includes("/admin/literature/")) assert.equal(source.includes("abstractText"), false, path);
    assert.equal(source.includes("server/literature"), false, path);
  }
  assert.equal(read("src/server/atlas/queries.ts").includes("abstractText"), false);
});

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

loadEnvFile(".env");

function isLocalDatabase(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const host = new URL(url).hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

test("search apply cannot change the 71 mechanism assessments or create findings", { skip: !isLocalDatabase(process.env.DATABASE_URL) }, async () => {
  const { PrismaClient } = await import("../../../generated/prisma/index.js");
  const { assertScientificSnapshotUnchanged, scientificSnapshot } = await import("./guard");
  const db = new PrismaClient();
  const stableKey = "lit:pmid:999000001";
  try {
    const beforeOutside = await scientificSnapshot(db);
    const bpaBefore = await db.compound.findUniqueOrThrow({
      where: { slug: "bpa" },
      select: { id: true, curationStatus: true, lastEvidenceSearchAt: true },
    });
    assert.equal(beforeOutside.mechanismCount, 71);
    assert.equal(beforeOutside.findingCount, 2);

    let rolledBack = false;
    try {
      await db.$transaction(
        async (tx) => {
          const before = await scientificSnapshot(tx);
          const hits = planLiteratureHits([], [
            paper({
              doi: "10.1000/phase3a.guard",
              pmid: "999000001",
              title: "Phase 3A guard paper that must not become a finding",
              year: 2024,
              abstractText: "Internal abstract that must not be public.",
              url: "https://pubmed.ncbi.nlm.nih.gov/999000001/",
            }),
          ]);
          await applyLiteratureRun(tx, {
            compoundId: bpaBefore.id,
            provider: "PUBMED",
            purpose: "CONTRADICTORY_OR_NULL",
            queryText: "guard query",
            resultWindow: "relevance",
            sortMode: "relevance",
            startedAt: new Date("2026-10-03T00:00:00Z"),
            completedAt: new Date("2026-10-03T00:00:01Z"),
            providerReportedCount: 1,
            status: "SUCCEEDED",
            errorText: null,
            hits,
          });
          await recordCompoundSearched(tx, bpaBefore.id, bpaBefore.curationStatus, new Date("2026-10-03T00:00:01Z"));
          const created = await tx.evidenceSource.findUniqueOrThrow({ where: { stableKey } });
          assert.equal(created.countsAsScientificEvidence, false);
          assert.equal(created.publicationStatus, "SCREENING_PENDING");
          assert.equal(await tx.evidenceFinding.count({ where: { sourceId: created.id } }), 0);
          assertScientificSnapshotUnchanged(before, await scientificSnapshot(tx));
          assert.equal((await scientificSnapshot(tx)).findingCount, 2);
          throw new Error("ROLLBACK");
        },
        { timeout: 20000 },
      );
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes("ROLLBACK")) throw error;
      rolledBack = true;
    }

    assert.equal(rolledBack, true);
    assert.equal(await db.evidenceSource.findUnique({ where: { stableKey } }), null);
    assertScientificSnapshotUnchanged(beforeOutside, await scientificSnapshot(db));
    const bpaAfter = await db.compound.findUniqueOrThrow({
      where: { slug: "bpa" },
      select: { curationStatus: true, lastEvidenceSearchAt: true },
    });
    assert.equal(bpaAfter.curationStatus, bpaBefore.curationStatus);
    assert.equal(bpaAfter.lastEvidenceSearchAt?.toISOString() ?? null, bpaBefore.lastEvidenceSearchAt?.toISOString() ?? null);
  } finally {
    await db.$disconnect();
  }
});
