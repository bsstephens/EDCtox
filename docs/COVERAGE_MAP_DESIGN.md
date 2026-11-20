# Coverage map: design

Written 20 Nov 2026. Design only. No schema change, no migration, nothing built yet.

Reference: [jscai.au](https://jscai.au/#/s/251), an atlas of 571 inquiry submissions — one dot each,
similar documents near each other, arrange-by and colour-by controls, filters, a detail panel. Two
things it does that this design copies outright: the caveat sits **under the controls** where the
reader is looking ("Submissions that discuss similar things sit close together. Distance and
direction have no other meaning"), and the list view is a **peer in the top navigation**, not a
fallback, holding the same information as text for keyboard and screen-reader users.

## 1. Why not an embedding

EDCtox has 280 mechanisms. Projecting them to two dimensions produces axes nobody can name, and a
compound far from the centre reads as _more toxic_ — the single reading this database exists to
refuse. A caveat line does not stop that reading, because the picture is the argument and the
caption is not. The jscai caveat works because nothing there is ranked; here the dots would be
chemicals, and people already arrive expecting a danger ranking.

Where a scatter does become defensible, the viewer picks a real domain for each axis — MET on x,
THY on y — so every position is a stored number with a name. That view is worth building once two
domains each hold enough scored compounds to make a cloud. Today one of them would hold sixteen
points, most of them overlapping, so it is not the first view.

Papers suit an embedding later. Papers have no natural axes, nobody reads a paper's distance from
the origin as harm, and the pipeline has not produced them yet.

**Coverage is the honest first picture.** 125 compounds × 8 profile columns is 1,000 cells. The 71
mechanism assessments, all on 16 compounds, fill **64 of them: 6.4%**. Showing how empty the matrix
is tells the truth, makes the argument for the pipeline better than any prose, and improves as
cells fill without needing a redesign.

Three views, in order: **coverage matrix now**, chosen-axis scatter when the data supports it,
paper embedding after the pipeline runs. This document designs the first.

## 2. What the map is

A matrix, not a scatter. Rows are compounds, columns are the 8 profile domains, one cell each.
Position is (compound, domain) and carries no other meaning, so there is nothing to misread as
distance. A cell is one mark; the grid is about 1,000 marks, which fits one screen at roughly 9 px
per cell with room for row labels.

The columns carry their **track** (`DomainTrack`), because the WHO/UNEP crosswalk is explicit that
MITO and REDOX are EDCtox's own contribution and not endocrine disruption in the report's sense.
Eight equal columns side by side is exactly what that crosswalk warned against, so the two tracks
are drawn as two labelled column groups with a rule between them.

## 3. What a cell means

The schema distinguishes states a naive heatmap flattens into one grey. The index table flattens
them today: `ScoreCell` renders `—` both for a domain with no assessment and for a domain assessed
and deliberately left unscored. The map must not repeat that.

| Cell state                         | In the data                                                                                                                     | Mark                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| **Scored**                         | ≥1 assessment, headline is an integer −4…+4                                                                                     | Solid mark, colour from _colour by_        |
| **No effect found**                | headline is `0` — a result, not a blank                                                                                         | Solid mark at the neutral tone, never grey |
| **Assessed, unscored on purpose**  | rows exist, `effectScore` null: `PHYSIOLOGICAL` activity, or a range that crosses zero, or `quantitativeScoreSupported = false` | Hollow outline                             |
| **Recorded, outside the headline** | rows exist but every one is `RESEARCH_ONLY` or `GROUPING_ONLY`                                                                  | Hollow outline, dotted                     |
| **Claims extracted, not assessed** | `MechanisticClaim` rows for this compound and domain, no `MechanismAssessment`                                                  | Faint dot _(reserved; empty today)_        |
| **Never assessed**                 | no row of any kind                                                                                                              | Nothing. Grid line only                    |

Three visual weights — solid, hollow, nothing — carry the distinction the task asks for. The exact
reason ("physiological activity at MT1/MT2", "range crosses zero", "research-only mechanism") goes
in the cell's text, not in a legend entry; a legend cannot hold six reasons honestly.

A second axis of honesty: every filled cell today is a `SEED_HYPOTHESIS`. _Colour by curation_ must
exist from day one so a reader can see that the filled block is hypotheses, not curated consensus.

The "claims extracted" row is how the map improves without a redesign. Reserving it now means the
pipeline's first output lands on an existing visual state rather than forcing a new one.

## 4. Controls

**Arrange by** (row order; column order stays `sortOrder` unless noted):

- _Work done_ — most domains assessed first. Default. Puts the 16 scored compounds in a block at the
  top and the 109 untouched ones below, which is the picture.
- _Name_ — A–Z, the neutral arrangement.
- _Category_ — `compoundType` bands: pharmaceuticals, bisphenols, PFAS, pesticides.
- _Track_ — which of the site's two tracks the compound mostly sits in.
- _Report salience_ — what WHO/UNEP 2026 discusses most, against what EDCtox has done. The strongest
  arrangement for the pipeline's argument, and the only one needing a field that does not exist (see
  open question 6).

**Colour by** (applies to solid marks only; hollow and empty states never take a colour):

- _Fill only_ — no colour at all. Default, and the honest first picture.
- _Effect score_ — the existing diverging teal→red ramp from `scoreTone`.
- _Human relevance_ — H0–H4.
- _Confidence_ — very low to very high.
- _Curation_ — seed hypothesis against curated.
- _Evidence behind it_ — count of `EvidenceFinding` rows, which is zero nearly everywhere.

**Filters** reuse the index page's existing query parameters exactly (`compoundType`, `legacy`,
`exposureClass`, `recordKind`, `q`), so the two pages stay one vocabulary.

**The caveat sits directly under the controls**, always visible, never a footnote:

> Each column is a domain and each row a compound. A cell's position says which compound and which
> domain, and nothing else. An empty cell means nobody has assessed it. It is not evidence of safety.

## 5. Moving out of the map

- **Cell** → `/compounds/<slug>#<DOMAIN>`, the domain card that already exists on the compound page,
  carrying the headline, the summary text and the trace. Needs an `id` on those cards: one line.
- **Row label** → `/compounds/<slug>`.
- **Column header** → the mechanisms list filtered to that domain, `/mechanisms?domain=<code>`.
- **Outcomes** are reached through the compound page. A 125 × 59 outcome matrix is a later mode, not
  this one (open question 8).

Every one of these is an ordinary link. No cell opens anything that does not already exist.

## 6. The non-visual equivalent

A **list view in the top navigation beside the map**, not a hidden alternative — the jscai pattern.
Same data, same filters, same URL parameters, as a sortable table: compound, then one column per
domain whose cell text is the state in words ("+3, seed hypothesis", "assessed, not scored:
physiological activity", "not assessed"), then a count of domains assessed out of 8.

The map itself is inline SVG with a `<title>` on every cell, so hover text and the accessible name
are the same string, and the whole grid is `role="img"` with a text summary naming the totals. A
cell's mark is a link, so the grid is keyboard-reachable in reading order without any JavaScript.
The list view exists because tabbing 1,000 cells is not navigation; it is the real equivalent.

## 7. Weight, and staying a server component

Yes, and it is lighter than the page it sits beside. Measured on the built app against the real
data: **the map is 245 KB raw and 16 KB gzipped, against the index table's 1,019 KB and 35 KB.**

Two estimates in the first draft of this document were wrong, and the real numbers are worth
keeping. First, the draft costed the markup only and ignored that Next.js inlines the RSC flight
payload into the same response, which roughly doubles every page; the first working version came
out at 419 KB raw rather than the ~60 KB predicted. Second, the draft assumed inline SVG. An HTML
table turned out better: it is tabular data, so it gets header semantics, keyboard order and
screen-reader navigation for free rather than needing them bolted onto a graphic. Most of the
remaining weight was the ~900 unassessed cells, so those are one short CSS class on the cell
itself (`.cov-empty`) instead of six utility classes on a nested element — which took 419 KB to
245 KB. Cells that mean something keep their full markup, their link and their title.

Everything stays a server component:

- Arrange-by and colour-by are a GET `<form>` writing query parameters, the same pattern the index
  page already uses. Each choice re-renders on the server. No client JavaScript.
- Hover and accessible names are native SVG `<title>`. No tooltip library.
- No detail panel in v1 (open question 7). A click goes to the compound page, which already holds
  everything a panel would show.
- Data comes from `loadCoverageMapCached`, a lean query of its own rather than a reuse of the
  index's loader, which drags in findings, measurements and revisions the map never shows. It
  reuses `summarizeDomain`, so a cell's headline is by construction the same number the table
  prints. Two derived fields were added to `DomainSummary`: `assessedMechanismCount` and
  `unscoredReason`. **No migration.**
- `robots.txt` already blocks query-string URLs, so the parameterised states stay out of the index
  and the default no-parameter map is the canonical page. Any write that changes it must call
  `revalidateTag(ATLAS_CACHE_TAG)`, like every other public page.

**Naming collision:** `src/server/coverage/` and the "Mechanism coverage" block on compound pages
already meant something else — how many extracted claims mapped to the ontology. The block is now
"Claim mapping" (decision 1); the module keeps its name.

## 8. How it degrades, and what it must never imply

While the data is thin the map is mostly empty, and that is the message rather than a failure: a
small filled block above a large blank field, with the counts in plain text beside it. What the
current data draws, exactly: 60 scored cells, 4 assessed and deliberately unscored, 0 scored zero,
0 research-only, 0 claims-only, and 936 never assessed. Every one of the 71 assessments is still a
seed hypothesis, which is why _colour by seed or curated_ is in the first version rather than a
later one. As the pipeline runs, the faint "claims extracted" state fills first, then
hollow marks, then solid ones; the picture shifts from emptiness to pattern and the colour-by
controls become the point. Nothing in the layout changes. When most cells are solid, the chosen-axis
scatter becomes worth building and the matrix stays as the navigation surface.

It must never imply:

- **That an empty cell is safety.** It is work not done.
- **That a fuller row is a worse compound.** Sorting by work done is sorting by our attention, never
  by harm, and the control is labelled _work done_ for that reason.
- **That cells add up.** No row total, no column total, no percentage bar. "5 of 8 domains assessed"
  is a statement about EDCtox; a 62% badge reads as a score and must not appear.
- **That the eight columns are equals.** The track grouping says which are endocrine disruption in
  the WHO/UNEP sense and which are EDCtox's own mechanistic layers.
- **That a filled cell is settled.** Every one is a seed hypothesis until curation says otherwise,
  and the map says so without being asked.

## 9. Decisions (20 Nov 2026)

The eight questions below are answered. Scott decided 1, 3 and 4; the rest were decided with
him. Built on this branch the same day.

1. **Route `/coverage`**, and the compound-page block renamed from "Mechanism coverage" to
   **"Claim mapping"** in the same change, so the two meanings stop colliding for readers.
   `src/server/coverage/` keeps its name: it is claim mapping, and renaming it would churn the
   mapping tests for no reader-facing gain. The new loader is `src/server/atlas/coverageMap.ts`.
2. **Default arrangement is alphabetical.** Work done stays a control. A default ordered by work
   done is the view most likely to be screenshotted, and a reader who has not read the caveat
   will take the top of that list for a ranking of harm.
3. **All 125 compounds.** The emptiness is the message, so the map does not inherit the index
   default of showing only compounds with content. The two views differ on purpose: the table
   answers "what do we know about this compound", the map answers "how much is still unknown".
4. **A Table / Map view switch**, not a sixth navigation item. Both are real routes, so the back
   button works and `robots.txt` — which blocks every query-string URL — still indexes both. It
   also settles section 6: the table _is_ the text equivalent, one labelled click away and
   presented as a peer rather than a fallback. The same switch can later carry a graph view on
   Mechanisms and a paper map on Evidence. Compare and Methodology get none.
5. **Non-profile domains are shown**, as a quieter third block to the right, labelled as stored
   and outside the headline columns. Hiding them would imply they do not exist; a reader seeing
   EXPOSURE and VASCULAR permanently empty is being told something true about the evidence.
6. **Report salience is derived from the 14 regulatory rows** for now, and the cruder ordering is
   accepted. No stored field yet: a field added before anything needs it gets filled in to
   justify itself.
7. **No detail panel.** A click goes to the compound page, which is already the detail view and
   is already cached. Worth revisiting once a cell has claims and findings behind it rather than
   a single seed assessment, because only then does a panel save a page load.
8. **Outcomes mode later, not never.** Outcomes stay on compound pages. It becomes worth building
   when outcome assessments exist in numbers — today there are 59 outcomes and almost no
   assessments against them, so a 125 × 59 grid would be one colour.

Two things did not survive contact with the code and are recorded in section 7.

## 10. Still open

Nothing blocking. The questions this document was written to ask are answered in section 9, which
restates each one. What is left is a judgement to make later, from the built page rather than from
a design:

- Whether the matrix should wrap into two or three panels side by side once a reader wants the
  whole thing on one screen. At 125 rows it is about two screens tall, and splitting it costs the
  single reading order that makes the alphabetical default easy to scan.
- Whether _colour by seed or curated_ should become the default once curated rows exist, since at
  that point "is this settled" is a more useful question than "is this assessed".
