# EDCtox phase 4: the damage model and the agent-run literature pipeline

Status: draft for review, 22 October 2026. Nothing in this document has been built.

This is the master prompt for the next phase, in the same form as the phase 1 to 3 prompts. Read it, change what is wrong, and say "proceed" on the slice you want first.

## 1. What changes

Two things.

**The product becomes a damage model.** EDCtox stops being a review desk with a scoring table behind it and becomes a ranking of compounds by the biological damage the literature supports, per domain, with the evidence trail visible. The scoring rules do not change. What changes is that the outcome layer, which the schema already has, becomes the headline, and the mechanism layer becomes the explanation.

**Reading the literature becomes the machine's job.** Today the "machine" stages are keyword rules written for one compound and one domain, and every write script refuses a database that is not localhost. In phase 4 a model screens, extracts, maps and proposes, for every compound and every domain, on a schedule, and the curator reviews exceptions instead of queues.

Neither change needs the schema redesigned. The phase 3 tables were built for this: `LiteratureSearchRun`, `LiteratureScreeningDecision`, `CurationAgentRun`, `MechanisticClaim` with separate machine and curator columns, `ClaimMappingEvent`, `AssessmentRevision`. The phase 3 prompt parked the extraction agents, score proposals, full text and ontology-gap records. This phase picks them up.

## 2. Rules that do not change

These are the phase 1 to 3 rules, restated so the agent work is bounded by them.

1. A search run never writes `EvidenceFinding`, `MechanismAssessment` or `CompoundOutcomeAssessment`. It writes candidate `EvidenceSource` rows only.
2. A machine never writes a curator column. `curatorDecision`, `curatorVerified`, `curatorMappingState`, `curatorNote`, `screenedBy` and the `VERIFIED` mapping state are a person's.
3. A score is a direction and a magnitude. Confidence, human relevance, developmental timing and exposure relevance stay in their own columns. Nothing multiplies them together.
4. No toxicity total. A domain headline is the strongest independent cluster. A compound profile is seven headlines, not one number. The damage model keeps this.
5. An abstract cannot support `DIRECTLY_DEMONSTRATED`. Full text can.
6. A machine-extracted supporting sentence is not shown publicly until the claim is curator-verified.
7. Third-party abstracts are stored for triage and never rendered verbatim on the public site.
8. Every machine write records provider, model and prompt version on a `CurationAgentRun`, and lists the source ids it read. No chain of thought is stored.
9. Re-running a stage with a newer prompt updates machine columns and never erases a curator decision.

## 3. The damage model

### 3.1 Vocabulary

The structure EDCtox already has is the OECD Adverse Outcome Pathway (AOP) structure. Naming the correspondence gives the extraction agent a public vocabulary to map to and gives readers a frame they know.

| EDCtox | AOP term | Example |
| --- | --- | --- |
| `Mechanism` (leaf, scorable) | Molecular initiating event or key event | ER-alpha agonism; complex I inhibition |
| `Mechanism` (grouping parent) | Key event grouping | Electron transport chain |
| `CausalPathway` | Key event relationships in order | ETC impairment → ROS → impaired insulin signalling → insulin resistance |
| `Outcome` | Adverse outcome | Reduced semen quality; insulin resistance |
| `BiologicalDomain` | Level of biological organisation plus organ system | Reproductive endocrinology |
| `aggregationGroup` | No AOP equivalent. EDCtox's anti-double-count key. | Complex I and complex II stay separate |

"Damage" in EDCtox means a signed adverse change at the outcome level, with the mechanism layer explaining how. The sign convention is the existing one: positive is disruptive, negative is protective or restorative, null is not scored. Physiological activity stays unsigned.

### 3.2 What ranks a compound

A compound's damage profile is its seven profile-domain headlines, each computed by the existing rules in `src/server/scoring`. Ranking inside a domain orders compounds by headline score, breaking ties by human relevance then confidence, which is the existing tie rule. A cross-domain ranking is shown as a profile and is not a sum. The methodology page already says this. The compare page already does most of it.

What is new is that the outcome layer carries the headline when outcome evidence exists. The display rule becomes: if a compound has a curated `CompoundOutcomeAssessment` in a domain, the domain cell shows the outcome and the mechanism cluster is its explanation; otherwise the mechanism cluster is the cell, as today. Both are shown in the trace. This needs no migration.

### 3.3 Three additions, none of them a schema redesign

1. **AOP-Wiki identifiers on mechanisms, pathways and outcomes.** `ExternalOntologyMapping` exists for this and is empty. The AOP-Wiki dataset row exists in `externalDatasets.ts`. A mapping agent proposes AOP ids per mechanism; a curator confirms. No DTXSID-style invention: an id is written only when the AOP-Wiki record has been fetched and its label matches.
2. **The ten Key Characteristics of endocrine-disrupting chemicals** (La Merrill et al., Nat Rev Endocrinol 2020) as a tag axis on `Mechanism`. This is one small table, `MechanismKeyCharacteristic`, added expand-only. It is a reviewer vocabulary, not a scoring input.
3. **Mechanism families for the 206 unfamilied mechanisms.** The chat left this open. The family audit found no parent family to copy from. The proposal is to let the mapping agent propose a family per mechanism from the AOP key-event grouping, written to a proposal column, and have the curator accept in batches on the existing mapping queue. Families are display only and do not enter scoring.

Nothing here changes a stored score.

## 4. The pipeline

Six stages. Each writes one `CurationAgentRun` per batch. Each has a dry-run that prints what it would write and a guard that stops it writing outside its lane.

| Stage | Reads | Writes | Model | Exists today |
| --- | --- | --- | --- | --- |
| 4.1 Discover | Search windows per compound × domain | `LiteratureSearchRun`, candidate `EvidenceSource` | None | Yes, BPA reproductive only |
| 4.2 Fetch | Candidate sources | `abstractText`; full text to object storage, not the database | None | Abstract only |
| 4.3 Screen | Title, abstract, purposes | `LiteratureScreeningDecision` machine columns | Haiku 5.5 | Keyword rules |
| 4.4 Extract and map | Title, abstract, full text when held, mechanism catalogue | `MechanisticClaim` machine columns, `machineMechanismId` | Opus 5.5 | Regex rules, five papers |
| 4.5 Propose | Verified and candidate claims per compound × mechanism | `AssessmentProposal` (new) | Opus 5.5 | No |
| 4.6 Audit | A sample of every batch | `CurationAgentRun.status`, a report | Opus 5.5 | No |

Haiku 5.5 is proposed for screening because the task is a bounded classification into the existing enums at high volume. Opus 5.5 is proposed where the task is reading science and deciding what a sentence supports. Both calls use structured output into the existing enum vocabularies so the model cannot invent a decision or reason code. The prompt version is a string constant per stage, as `SCREENING_PROMPT_VERSION` is today, and changes with the prompt text.

### 4.1 Discover

Generalise `src/server/literature/queries.ts` from one hard-coded BPA query set to a query per compound × domain × purpose, generated from the compound's name, aliases and CAS and from a per-domain endpoint vocabulary, and versioned as today. Date windows make the weekly run incremental: each run asks for papers since the last successful run for that compound × domain. `LiteratureSearchRun` records a result window today (relevance or recent), not a date range, so two nullable columns, `searchedFrom` and `searchedTo`, are added expand-only.

The three purposes stay: systematic reviews, major human studies, contradictory or null evidence. A fourth, mechanistic experimental studies, is added because the extraction stage needs them and the current three select against them.

Seeding is a curated file, `docs/seed-knowledge/`, one file per compound, holding the searches the curator considers canonical and the facts an agent should know before reading a paper on that compound, for example that DEHP acts through MEHP. The discover and extract stages read it. It is prose under version control, not a database table, because it is instructions, not evidence.

### 4.2 Fetch

Europe PMC serves full text for open-access papers as XML. For those, fetch and store the text in object storage keyed by `EvidenceSource.id`, record two new nullable columns on the source, `fullTextRetrievedAt` and `fullTextLicence`, and let 4.4 read it. Paywalled papers stay abstract-only and the screen stage may say `FULL_TEXT_NEEDED`. No paywall fetching, as before.

### 4.3 Screen

Replace `suggestDeterministic` with a Claude-backed `SuggestionProvider`. The interface in `applySuggestions.ts` already takes a provider function, so the deterministic one becomes a test fixture. The provider type becomes async. The output is the same `MachineSuggestion` shape: decision, reason code, confidence, one-paragraph rationale, governing purpose. The reason code list in `reasons.ts` is the only vocabulary. The prompt receives the compound's seed-knowledge file and the domain's endpoint vocabulary.

Acceptance before this replaces the rules on production: run against the 90 BPA reproductive candidates in dry-run, compare with the 20 existing machine suggestions and with every curator decision that exists, and report agreement. Disagreements are read by hand. The rules are not retired until the curator prefers the model's calls.

### 4.4 Extract and map

Replace `extractMechanisticClaims` with a Claude-backed `ClaimExtractor` behind the existing `ClaimExtractor` type in `apply.ts`. The output is the existing `ClaimDraft` shape, including the quoted support sentence, species, tissue, dose and measure fields, directness, and a mechanism code from the catalogue or `UNMAPPED`.

Mapping rules carried over: a grouping-only parent is rejected as a target; a code not in the ontology is rejected and the claim stays unmapped; the machine suggestion is frozen in `machineMechanismId`; re-extraction updates machine fields and never replaces a curator action. One addition: when the model believes the paper names a mechanism the ontology lacks, it writes an `OntologyGap` row (new, expand-only: compound, source, proposed label, proposed parent, rationale) instead of inventing a code. Gaps are a queue for the curator.

Directness ceiling: abstracts cap at `STRONGLY_SUPPORTED`; full text may reach `DIRECTLY_DEMONSTRATED`; reviews cap at `INFERRED`. The extractor is told the text origin and the ceiling.

### 4.5 Propose

This is the stage the phase 3 prompt called score proposals and parked. The model never edits a `MechanismAssessment`. It writes an `AssessmentProposal` (new table): compound, mechanism, the proposed direction, magnitude, effect score, confidence and human relevance, a summary, the claim ids it rests on, and the prompt version. The curator accepts, edits or declines on an admin page. Acceptance writes the assessment and an `AssessmentRevision` with the proposal id as the reason, through the existing revision path, so the audit trail is unchanged.

A proposal is only generated when at least one curator-verified claim supports it, or when a seed hypothesis has no literature at all and the model is asked whether the seed should become `INSUFFICIENT`. This keeps machine reading from moving a score on its own.

### 4.6 Audit

A second model pass, with a different prompt, reads a random ten percent of each batch's screening decisions and claims and reports agreement, missed claims and over-reach. Disagreement above a threshold marks the run `NEEDS_REVIEW` and the batch waits for a person. This is the check that lets the curator stop reading every queue.

## 5. What the curator does

Exception-based review. The person is asked to look at:

- every `OntologyGap`;
- every claim the audit pass disagreed with;
- every `AssessmentProposal`, because a score never moves without a person;
- a random sample of accepted screening decisions each week, size set by the audit agreement rate;
- the mapping queue, as today, but ordered by the number of claims each unverified mapping would unblock.

Everything else the machine marks and the site shows as machine-derived, with that status visible.

## 6. Where it runs

Three options, in the order to use them.

1. **Now: Claude Code cloud sessions, interactively.** Covered by the Max subscription. Each stage runs from a session against the repo, with the model work done by the session itself through the stage's provider interface. This is how 4.3 and 4.4 are developed and compared against the curator's calls.
2. **Next: a scheduled Claude Code cloud task, weekly.** Also covered by Max. The task runs discover, fetch, screen, extract and audit for every compound × domain with a new window, and posts a summary. The code path is identical to option 1; only the trigger differs.
3. **Later, if volume warrants: the Claude API's Batch endpoint from a GitHub Actions cron.** Half price per token and no session tied up. This needs an API key and API billing, which the Max plan does not cover. It is the same provider code with a different transport.

The provider interface is written once, so moving between these is a configuration change.

### 6.1 The production write guard

The localhost-only guard in `screening/cli.ts` and `claims/cli.ts` is replaced by a lane guard. A stage may write to production when `EDCTOX_MACHINE_WRITE=1` is set, and the apply functions are restricted, in code and in tests, to the machine columns listed in section 2. A test asserts that no apply function references a curator column. The 71 assessments are checked by snapshot before and after every run, as `guard.ts` does today, and a run that changes one fails and rolls back.

### 6.2 Things that must be true first

From the open threads in `docs/cursor-history/README.md`:

- **Admin pages need auth** before machine writes land on production, because the proposal and gap queues will be where decisions are made. A single review key in the Vercel environment is enough for one curator.
- **Preview deployments must not share the production database.** Confirm in Vercel before the scheduled task exists.
- **Re-seeding must refuse production.** The seed overwrites seeded assessment keys. A guard like the one in section 6.1, inverted, is enough.

## 7. Evaluation

Prompts change. A prompt that reads worse than the last one must not ship. The gold set is built from what the curator has already decided and grows with every decision:

- screening: every row with a `curatorDecision`;
- claims: every curator-verified claim and every curator unmap, as negatives;
- mapping: every `ClaimMappingEvent`.

`npm run eval:pipeline` runs the current prompts over the gold set in dry-run and prints agreement per stage. A drop against the last recorded run blocks the version bump. The tests in `src/server/*/*.test.ts` keep covering the apply functions with the deterministic fixtures, so they stay fast and need no model.

Scale, to set expectations rather than to budget: 116 compounds across seven domains is on the order of a few hundred new papers a week. Screening that many abstracts with Haiku 5.5 costs cents. Extraction with Opus 5.5 over the ones that pass costs dollars. Neither is a reason to wait.

## 8. Slices, in order

Each slice stops for review, as phases 1 to 3 did.

- **4A Screener.** Claude-backed `SuggestionProvider`; async provider type; prompt version `bpa-reproductive-claude-v1`; dry-run comparison against the 20 suggestions and all curator decisions; report. No production write. No schema change.
- **4B Extractor.** Claude-backed `ClaimExtractor`; `OntologyGap` table; run over the 90 BPA candidates that screened as include; compare against the 17 claims. One expand-only migration.
- **4C Breadth.** Query generation per compound × domain; the mechanistic purpose; seed-knowledge files for the first ten compounds; windows; lane guard; auth on admin pages. First non-BPA, non-reproductive run, on TFA as the phase 3 prompt intended, then DEHP and PFOS.
- **4D Proposals and audit.** `AssessmentProposal`; the audit pass; the proposal page; the first machine-proposed, curator-accepted score change, with its revision.
- **4E Schedule.** The weekly cloud task; full text from Europe PMC; the AOP-Wiki mapping agent; Key Characteristics table; family proposals.

4A is a day of work and proves the shape. Nothing in 4A touches production or the schema.

## 9. Decisions needed

1. Agree the damage model framing in section 3, in particular that the outcome layer carries the headline when outcome evidence exists.
2. Agree that a score never moves without a person, even in 4E. The alternative, auto-accepting proposals above a confidence bar, is possible and is not proposed.
3. Agree the model split, Haiku 5.5 for screening and Opus 5.5 for extraction, proposals and audit.
4. Say whether the first ten seed-knowledge files should be written by you, by the model from the current seed assessments for you to correct, or both.
5. Say whether 4A should start now.
