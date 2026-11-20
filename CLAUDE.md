# EDCtox (edc.fyi)

Research database comparing compounds across endocrine, developmental, immune, metabolic,
mitochondrial and redox mechanisms. Scores summarise evidence direction and magnitude; there is
deliberately no compound-level toxicity total. Read README.md "Schema review" before touching
the schema. Scott is the sole developer; no PR process, no staging.

## Stack

Next.js 15 app router, TypeScript, tRPC 11 (server caller only, no client queries), Prisma 6,
Postgres, Tailwind, Vercel (Hobby, functions pinned to Tokyo `hnd1`). Prisma client is generated
into `generated/prisma`. Every public page is a server component.

## Commands

- `npm run dev` against local Postgres 15 (`LC_ALL=C pg_ctl -D /opt/homebrew/var/postgresql@15 start`)
- `npm run typecheck`, `npm run test:scoring`, `SKIP_ENV_VALIDATION=1 npm run lint` — run all three
  before each commit (`next lint` validates env at config load, hence the flag)
- `npm run literature:claims -- --dry-run --compound bpa --domain reproductive` runs the
  rule-based extractor over the five-paper pilot. Add `--cohort included` for the 52 screened
  BPA reproductive papers, `--extractor claude` to use the model (costs money, prompts first),
  `--inspect N` to read the first N without writing, and `--pmids a,b` to re-read specific
  papers. `--all` is refused: another compound or domain is a change of scope, not a bigger run.
- `npm run db:seed` — local only. The seed upserts seed scores over curated rows; never run it
  against production.
- `literature:*` and `external:resolve` refuse a non-localhost database unless pointed at one.

## Rules that do not change

- Scoring rules live in `src/server/scoring/`. Do not change them without an
  `AssessmentRevision`. `test:scoring` protects the 71 seeded mechanism assessments and 2
  structural findings; it must stay green.
- Machine stages (search, screening, extraction, mapping) write machine columns only. They never
  create `EvidenceFinding` rows or change a `MechanismAssessment` or `CompoundOutcomeAssessment`.
  Curator decisions live in separate columns.
- Migrations are expand-only and ship with their code. Vercel runs `prisma migrate deploy` in the build.
- `/admin/*` routes are unlisted; only the claims list and mapping queue render in production.
- Public pages read through `src/server/atlas/cached.ts` (one-day data cache, tag `atlas`).
  Any new write that changes what a public page shows must call
  `revalidateTag(ATLAS_CACHE_TAG)`. Admin pages read the database directly. `robots.txt`
  blocks `/admin`, `/api` and all query-string URLs; keep new list pages inside that rule.
- A claim's `stableKey` decides what a re-extraction updates rather than duplicates. It is
  `claim:{producer}:{hash}`, hashed over the evidence source, subject, relation and the object's
  **head** where a model supplied one. The producer keeps the rule-based and model-backed
  extractors from overwriting each other's rows; the head keeps a re-read updating a claim
  rather than stranding it, since model phrasing drifts between runs. Changing either is a
  data migration, not just a code change.
- Claim extraction runs on `claude-haiku-5-5`, twice per abstract, keeping the union. Opus 5.5
  refuses the task outright, which `src/server/claims/claude.ts` records; do not reword the
  prompt to get around it. A claim fewer passes read is queued `REVIEW_REQUIRED` and stores the
  counts, so "one reading of two" is distinguishable from "did not map".
- A claim points at a `Mechanism` or an `Outcome`, never both, and a `GROUPING_ONLY` mechanism is
  refused as a claim target. Mapping is exact matching on keys built from the ontology itself:
  no fuzzy matching, no nearest neighbour. A term the ontology does not hold stays unmapped so
  the gap stays visible. See `docs/CLAIM_SYNONYM_PROPOSALS.md` for the pending vocabulary work.
- Shipping a seed change is deploy, seed, then **redeploy**: anything cached between the deploy
  and the seed serves pre-seed data for a day. The cache key is the deployment id, not the
  commit, so a redeploy of the same commit does change it. Locally, `rm -rf .next/cache` after
  seeding or the dev server shows stale pages and you will think the seed failed.

## Database (since 23 Oct 2026)

Production is Supabase Postgres, project `edify`, free plan, Tokyo. Vercel Production holds
`DATABASE_URL` (transaction pooler, port 6543, `pgbouncer=true`) and `DIRECT_URL` (session
pooler, port 5432). The IPv6-only direct host is not used. To run anything against production
from this machine, put both strings in `.env.supabase.local` (gitignored) and pass them as
environment variables to that one command. Never commit or print them.

Preview deployments never touch production: Preview has no database variables, and the
Ignored Build Step (dashboard and `vercel.json` `ignoreCommand`) cancels every non-production
build. Do not add production strings to Preview.

Background: `docs/ops/DATABASE_OPERATIONS_2026-10.md` (why the previous database was
suspended and the per-page query costs), `docs/AGENT_PIPELINE_DESIGN.md` (phase 4 design),
`docs/cursor-history/` (the original build chat).

## Working with Scott

He is learning Claude Code: say in one line what a command does before running it, and name the
Claude Code feature when you use one. Ask before anything that deletes data, changes a Vercel
variable, redeploys production or could cost money. Keep everything on free tiers.
