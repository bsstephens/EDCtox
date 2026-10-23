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
- `npm run db:seed` — local only. The seed upserts seed scores over curated rows; never run it
  against production.
- Literature and identity scripts (`literature:*`, `external:resolve`) refuse non-localhost
  databases unless explicitly pointed at one. Keep it that way.

## Rules that do not change

- Scoring rules live in `src/server/scoring/`. Do not change them without an
  `AssessmentRevision`. `test:scoring` protects the 71 seeded mechanism assessments and 2
  structural findings; it must stay green.
- Machine stages (search, screening, claim extraction, mapping suggestions) write machine
  columns only. They never create `EvidenceFinding` rows or change `MechanismAssessment` or
  `CompoundOutcomeAssessment`. Curator decisions are separate columns.
- Migrations are expand-only and ship with the code that needs them. Vercel runs
  `prisma migrate deploy` in the build (`vercel.json` → `npm run vercel-build`).
- `/admin/*` routes are unlisted; only the claims list and mapping queue render in production.
- Public pages read through `src/server/atlas/cached.ts` (one-day data cache, tag `atlas`).
  Any new write that changes what a public page shows must call
  `revalidateTag(ATLAS_CACHE_TAG)`. Admin pages read the database directly. `robots.txt`
  blocks `/admin`, `/api` and all query-string URLs; keep new list pages inside that rule.

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
