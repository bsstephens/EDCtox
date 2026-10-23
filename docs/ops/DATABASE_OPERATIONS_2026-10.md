# Where the 200,000 database operations went (October 2026)

Written 23 Oct 2026 while production was suspended. Prisma Postgres (free plan) counts every SQL
statement the Prisma client sends as one "operation"; the plan allows 100,000 a month and the
project used 200,470 between 3 Oct (first deploy) and 22 Oct.

Method: statement logging (`log_statement = 'all'`) on the local Postgres 15 copy of the
database, dev server loaded each route twice with `curl`, statements counted between markers.
`SET`, `BEGIN`, `COMMIT` and `DEALLOCATE` are excluded; if Prisma Postgres bills those too, every
number below is roughly 20% low. No code was changed.

## 1. Queries per page view

| Route | Statements | Notes |
|---|---:|---|
| `/` (compound index, any filter or sort) | 16 | `listCompounds()` loads all 116 compounds with nested includes; filters and sorts run in memory, so every `?q=`, `?domain=`, `?sort=` permutation costs the same 16. |
| `/compounds/[slug]` | 48–53 | `getCompound()` does one very wide `include`, then a **second** `findUniqueOrThrow` on the same compound with the same assessment include (duplicate ~15 statements), then loads **all 273 mechanisms** with domain and parent. |
| `/compare?slugs=a,b,c` | 100 | `compare` calls `getCompound()` once per slug in a loop (N × ~33–50). |
| `/compare?slugs=` 6 compounds | 245 | Same loop. The seven preset links on the page are crawlable. |
| `/evidence` (any filter) | 6 | |
| `/mechanisms` (any filter) | 6 | |
| `/mechanisms/[code]` | 10 | 273 such pages exist. |
| `/methodology` | 0 | Static content. |
| `/api/trpc/atlas.counts` | 6 | Publicly reachable, not linked. |
| `/compounds/<missing>` (404) | 1 | |
| `/admin` | 6 | Admin routes return 404 in production except the two below. |
| `/admin/literature/claims` | 3 | Live in production. |
| `/admin/mechanisms/mapping` | 16–18 | Live in production. |
| `/admin/literature`, `/admin/external` | 5, 2 | Local only. |

There are **no client-side tRPC calls**: every page is a server component using the server
caller, so there is no React Query refetch-on-focus multiplier. Every route exports
`dynamic = "force-dynamic"`, so nothing is cached and every request pays the full count.

One complete crawl of the public site costs roughly:

| Pages | Each | Total |
|---|---:|---:|
| 116 compound pages | ~50 | 5,800 |
| 273 mechanism pages | 10 | 2,730 |
| 7 compare presets | ~130 | 910 |
| `/` plus 8 sort-link variants | 16 | 144 |
| `/evidence`, `/mechanisms` and filter variants | 6 | ~100 |
| **One full crawl** | | **~9,700** |

200,000 operations over 20 days is therefore about **one full-site crawl per day**, which is
what several search and AI crawlers hitting a new public site with ~400 distinct URLs looks like.
Human traffic on a site this new would not reach that figure.

Bandwidth is a separate problem worth noting: `/` returns 3.0 MB of HTML, `/mechanisms` 2.2 MB,
`/compare` with six compounds 2.7 MB, because the full serialized data is embedded in the page.
That does not cost database operations but does cost Vercel bandwidth.

## 2. Requests per day

The Vercel CLI cannot read Observability, and Hobby runtime logs are kept for an hour, so this
needs the dashboard. **Scott, please open and paste back:**

1. vercel.com → `edc.fyi` project → **Observability** (or **Analytics** if that tab exists) →
   set the range to **Last 30 days** → paste the **total requests** figure and the **Top paths**
   table (top 10 or so with counts).
2. On the same page, if a **User agents** or **Bots** breakdown is shown, paste the top entries.
3. Prisma console → `prisma-postgres-copper-bridge` → **Usage** → paste the daily operations
   figures for 3, 4, 6, 7 Oct and a few typical days after that, or describe the graph shape.

Update 23 Oct: the Hobby plan only shows the last 12 hours. In that window, with the site
returning errors on every function call (77.8% error rate, the database being suspended), the
CDN still served roughly 150 requests, about 300 a day, in small bursts. Visitors that keep
arriving at a broken site in bursts are crawlers, which supports the one-crawl-a-day reading
above. The Prisma console figures are still worth pasting in when convenient.

Crawlability: there is **no `robots.txt` and no sitemap**. Every compound, mechanism and compare
preset is linked from the site, and the compound index has eight column-sort links, each a
distinct URL. Filter forms submit by GET, so any filter combination is also a distinct URL that a
crawler can revisit forever once it sees one. Nothing tells crawlers to stay out of `/admin`,
`/api/trpc` or query-string permutations.

## 3. Builds

`vercel ls` shows 14 deployments in the project's life: 9 successful (3 and 6 Oct) and 5
failures on 22 Oct (after the suspension, so they consumed nothing). A successful build runs
`prisma migrate deploy`, which is a handful of statements plus the migrations themselves;
`postinstall` is `prisma generate` and does not touch the database.

Estimated share: **under 200 operations, about 0.1%.** Builds are not the problem.

Preview deployments did share `DATABASE_URL`, `POSTGRES_URL` and `PRISMA_DATABASE_URL` with
Production (confirmed with `vercel env ls`), so a branch build would have migrated production.
That is a safety problem rather than a usage one, and step 4 fixes it.

## 4. Scripts

Measured by running the seed against a throwaway local copy with statement logging:

| Script | Statements | Ran against production |
|---|---:|---|
| `prisma/seed.ts` via `scripts/seed-production.sh` | 1,090 (599 inserts, 323 updates, 168 selects) | once, 3 Oct |
| `scripts/copy-claim-pilot.ts` (5 papers, 17 claims) | ~50 | once, 6 Oct |
| `literature:search --apply`, `literature:screen`, `external:resolve --apply` | – | never (local only; production has 0 identifiers and 0 screening decisions) |

Estimated share: **~1,200 operations, about 0.6%.** The jumps on the Prisma graph on 3 and
6 Oct coincide with the site going live and with the mechanism pages (273 new crawlable URLs)
being deployed, which fits crawling better than the scripts.

## 5. Ranked fixes

| # | Fix | Estimated reduction | Effort |
|---|---|---|---|
| 1 | **Cache the data layer.** Wrap `listCompounds`, `getCompound`, `listEvidence` and the mechanism queries in `unstable_cache` keyed by their arguments with a long `revalidate` (24 h or more; the data only changes on deploy or curation) and call `revalidateTag` from the deploy or admin writes. `revalidate` on the route alone will not work because the list pages read `searchParams`, which forces dynamic rendering. Admin routes stay uncached. | **90–98%** of page-driven operations. Worst case becomes one query set per distinct cache key per revalidate period (~400 keys × ~10–50 ≈ 8,000 a day if every page is refetched daily; typical far less). | Small |
| 2 | **Make compare cheap.** Compare only renders the seven domain cells, which is the index shape, not the full compound page. Replace the per-slug `getCompound` loop with one `findMany({ where: { slug: { in } } })` using the index include. | Compare: 100–245 → ~16 per view (**85–95%**). | Small |
| 3 | **Remove the duplicate load on the compound page.** `getCompound` already has every assessment it needs for `cellsFor`; drop the second `findUniqueOrThrow`, and select only `id, code, scorePolicy, domain` from the mechanisms query. | Compound page 53 → ~35 (**~35%**); also halves what fix 1 spends on a cold cache. | Small |
| 4 | **`robots.txt` and a sitemap.** Disallow `/admin`, `/api`, and any URL with a query string (`/*?*`), and list the canonical compound and mechanism URLs in a sitemap. | Cuts well-behaved crawler requests; the share depends on the dashboard numbers, likely **30–60% of requests**. Does not stop bad bots, which is why fix 1 matters more. | Trivial |
| 5 | **Preview deployments off production** (step 4). | Negligible usage, large safety gain. | Trivial |
| 6 | Optional: trim the serialized data embedded in `/`, `/mechanisms` and `/compare`. | Bandwidth only, no operations. | Medium |

Fixes 1–3 together take the measured full-crawl cost from ~9,700 operations to a cold-cache
cost of roughly 3,000 and a warm-cache cost near zero, well inside any free tier, including
Supabase's unmetered query count. Fix 4 reduces how often the cache is cold.
