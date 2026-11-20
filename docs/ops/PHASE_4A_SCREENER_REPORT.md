# Phase 4A screener report: Claude-backed screening compared with the keyword rules

Written 25 Oct 2026 on branch `claude/affectionate-wu-e76c74`. Slice 4A of
`docs/AGENT_PIPELINE_DESIGN.md` (section 8). Nothing here touched production or the schema, and
no screening decision was written anywhere; the run was `--dry-run` against the local database.

## 1. What was built

- `src/server/screening/claude.ts`: a `SuggestionProvider` backed by Claude Haiku 5.5
  (`claude-haiku-5-5`), prompt version `bpa-reproductive-claude-v1`. The model sees the title,
  abstract, search purposes and the reason codes offered for that queue, and answers through
  structured output into the existing `ScreeningDecision`, `ScreeningReason` and
  `ScreeningConfidence` enums. An answer outside the vocabulary, or a decision paired with a
  reason the queue does not offer, is an error, never a guess. The one-paragraph rationale is
  capped at 400 characters; no chain of thought is requested or stored.
- `SuggestionProvider` is now async, and `applyMachineSuggestions` records provider, model and
  prompt version on the `CurationAgentRun` (design rule 8). The deterministic rules keep their
  own provenance (`deterministic`, `bpa-reproductive-screen-v1`).
- The transport is a completion function. The API transport reads `ANTHROPIC_API_KEY`, declared
  optional and server-only in `src/env.js`. A transcript transport replays recorded answers,
  which is what the tests use (`src/server/screening/fixtures/claude-screening.fixture.json`)
  and what `--transcript <file>` uses on the command line. Each transcript entry is bound to a
  SHA-256 of the prompt it answered, so a changed prompt cannot replay a stale answer.
- `npm run literature:screen -- --compound bpa --domain reproductive --pending --dry-run
  --provider claude` runs the comparison set (every pending BPA reproductive paper that has a
  curator or machine decision, at most 20) and prints, per paper, the machine suggestion, the
  Claude suggestion and the curator decision, then agreement rates. `--write-prompts <file>`
  dumps the exact prompts and stops. `--provider claude --apply-suggestions` is refused in 4A;
  writing model suggestions waits for the lane guard in 4C. The localhost-only guard is unchanged.
- Tests: `claude.test.ts` covers the prompt, the vocabulary check, transcript replay and the
  CLI flags, and `screening.test.ts` now also checks that an async provider's provenance lands
  on the run row while the curator decision on the same row is untouched. The default suite
  never calls the network. `npm run typecheck`, `npm run test:scoring` (90 tests) and
  `SKIP_ENV_VALIDATION=1 npm run lint` pass.

## 2. Method, and two departures from the brief

**There is no curator gold set.** The brief said the local database held 20 curator decisions.
It holds 20 machine suggestions (written 5 Oct 2026 by the deterministic rules) and zero curator
decisions, and the cursor history confirms the screening desk was never decided and never copied
to production (`docs/cursor-history/README.md`, open threads). So the "Claude vs curator" and
"machine vs curator" rates below are not computable. The comparison that could be made is
Claude against the existing machine suggestions, with the disagreements read by hand (by this
session, not by the curator). Those hand readings are opinions for Scott to confirm or overturn
on `/admin/literature`; they are not curator decisions.

**The model ran through Claude Code, not the API.** No `ANTHROPIC_API_KEY` was available in the
session (the one-paper probe stopped with the intended error). Following design section 6,
option 1, the 20 prompts were dumped with `--write-prompts`, each was given unchanged to a
Claude Code Haiku subagent (one paper per agent, mirroring one request per paper), and the 20
JSON answers were recorded into `docs/ops/phase-4a/claude-screening-transcript.json`. The
dry run then replayed that transcript through the real provider path, including the vocabulary
check. Two caveats: the subagent carries Claude Code's own harness prompt alongside the
screening prompt, and the API call would use structured output rather than free-text JSON. The
API run is one command once a key exists and will overwrite nothing: entries already in the
transcript are replayed, so point it at a new file to get fresh answers.

Comparison set: the 20 pending BPA reproductive publications with a machine suggestion
(5 systematic-review queue, 8 human-reproductive queue, 7 contradictory-or-null queue).

## 3. Per-paper table

Decision, reason code and confidence. Curator column is empty throughout (see section 2).

| # | PMID | Queue | Machine (rules) | Claude (Haiku 5.5) | Agree |
|---|---|---|---|---|---|
| 1 | 41967509 | SR | INCLUDE META_ANALYSIS HIGH | INCLUDE META_ANALYSIS HIGH | yes |
| 2 | 42369063 | SR | INCLUDE META_ANALYSIS HIGH | INCLUDE META_ANALYSIS HIGH | yes |
| 3 | 42500194 | SR | INCLUDE SYSTEMATIC_REVIEW HIGH | INCLUDE SYSTEMATIC_REVIEW MODERATE | yes |
| 4 | 41354316 | SR | INCLUDE META_ANALYSIS HIGH | INCLUDE META_ANALYSIS MODERATE | yes |
| 5 | 41367717 | SR | INCLUDE META_ANALYSIS HIGH | INCLUDE SYSTEMATIC_REVIEW HIGH | decision only |
| 6 | 42676940 | HR | UNCERTAIN MIXED_OR_UNCLEAR LOW | EXCLUDE NARRATIVE_REVIEW_ONLY MODERATE | no |
| 7 | 41963602 | HR | EXCLUDE WRONG_BISPHENOL HIGH | EXCLUDE WRONG_BISPHENOL HIGH | yes |
| 8 | 42394387 | HR | UNCERTAIN MIXED_OR_UNCLEAR LOW | EXCLUDE NARRATIVE_REVIEW_ONLY MODERATE | no |
| 9 | 42551576 | HR | EXCLUDE NARRATIVE_REVIEW_ONLY MODERATE | EXCLUDE NARRATIVE_REVIEW_ONLY HIGH | yes |
| 10 | 41966417 | HR | INCLUDE DIRECT_HUMAN_EVIDENCE MODERATE | EXCLUDE NARRATIVE_REVIEW_ONLY MODERATE | no |
| 11 | 42632720 | HR | EXCLUDE EXPOSURE_ONLY MODERATE | EXCLUDE EXPOSURE_ONLY HIGH | yes |
| 12 | 41826072 | HR | EXCLUDE IN_VITRO_ONLY MODERATE | EXCLUDE IN_VITRO_ONLY HIGH | yes |
| 13 | 42802223 | HR | EXCLUDE NARRATIVE_REVIEW_ONLY MODERATE | EXCLUDE NARRATIVE_REVIEW_ONLY HIGH | yes |
| 14 | 42612744 | CN | EXCLUDE WRONG_BISPHENOL HIGH | EXCLUDE WRONG_BISPHENOL HIGH | yes |
| 15 | 42616413 | CN | EXCLUDE WRONG_BISPHENOL HIGH | EXCLUDE WRONG_BISPHENOL HIGH | yes |
| 16 | 41854205 | CN | INCLUDE REPRODUCTIVE_RELEVANCE LOW | INCLUDE REPRODUCTIVE_RELEVANCE HIGH | yes |
| 17 | 42208228 | CN | INCLUDE REPRODUCTIVE_RELEVANCE LOW | INCLUDE REPRODUCTIVE_RELEVANCE MODERATE | yes |
| 18 | 39486680 | CN | INCLUDE REPRODUCTIVE_RELEVANCE MODERATE | EXCLUDE WRONG_DOMAIN HIGH | no |
| 19 | 40064164 | CN | INCLUDE REPRODUCTIVE_RELEVANCE MODERATE | INCLUDE REPRODUCTIVE_RELEVANCE MODERATE | yes |
| 20 | 39195676 | CN | INCLUDE REPRODUCTIVE_RELEVANCE MODERATE | EXCLUDE WRONG_DOMAIN HIGH | no |

SR = systematic reviews, HR = human reproductive, CN = contradictory or null (governing purpose).
Titles and the model's rationales are in the transcript file and in the dry-run output.

## 4. Agreement rates

| Comparison | Decision | Decision and reason code |
|---|---|---|
| Claude vs curator | not computable (0 curator decisions) | not computable |
| machine vs curator | not computable (0 curator decisions) | not computable |
| Claude vs machine | 15/20 (75%) | 14/20 (70%) |

Every answer parsed and passed the vocabulary check; no paper errored. The model never used
UNCERTAIN, where the rules used it twice. By queue, Claude and the rules agreed on all five
systematic-review papers and all seven exclusions; the five decision disagreements are three
rule INCLUDE or UNCERTAIN calls on narrative reviews and two rule INCLUDE calls on
non-reproductive outcomes.

## 5. The disagreements, read by hand

One line each on who looks right from the title and abstract. These are this session's readings,
not the curator's.

- **5 (41367717, flavonoids vs BPA, rodent SR+MA).** Reason code only. The title says "systematic
  review and meta-analysis"; the rules chose META_ANALYSIS, Claude SYSTEMATIC_REVIEW. Both fit;
  META_ANALYSIS is the more specific code, so the rules' call is marginally better.
- **6 (42676940, BPA and ovarian cancer).** The abstract opens "This review summarizes" and
  describes no systematic method, so on the human queue it is a narrative review. Claude's
  EXCLUDE NARRATIVE_REVIEW_ONLY is right; the rules could not tell. Ovarian cancer is also an
  oncology outcome rather than a reproductive one, which strengthens the exclusion.
- **8 (42394387, BPA and male reproductive health, mechanistic review).** A mechanistic narrative
  review with no human study. Claude is right; the rules' UNCERTAIN was a safe miss.
- **10 (41966417, bisphenols and PFAS, women's reproductive health).** "This review integrates
  current experimental and epidemiologic evidence." It is a narrative review, not a human study.
  The rules' INCLUDE DIRECT_HUMAN_EVIDENCE was triggered by the word "women"; Claude is right.
- **18 (39486680, PEACE study, offspring autistic behaviours).** Preconception and pregnancy BPA
  measured in parents, but the only outcome is offspring autistic behaviour, a neurodevelopmental
  endpoint. For the reproductive domain Claude's EXCLUDE WRONG_DOMAIN is right; the paper may
  belong to the developmental queue, which is a different screening row.
- **20 (39195676, EARTH study, serum lipids in pregnant women).** Lipids are a metabolic outcome.
  Claude is right; the rules matched "pregnant" and a reproductive keyword.

Net: in the five decision disagreements the model's call looks right every time, and in the one
reason-only disagreement both codes are defensible. Two things worth watching in a larger run:
the model never answered UNCERTAIN, so it may be over-confident on thin abstracts, and on paper 4
(a network meta-analysis of nine inducers) it included with MODERATE confidence while noting the
abstract gives BPA no estimate of its own; that is the right nuance but a curator might prefer
UNCERTAIN.

## 6. Recommendation

The provider is good enough to run over the remaining 70 BPA reproductive candidates **in dry
run**, writing nothing, so the curator sees a model suggestion beside the rule suggestion for all
90. It is not yet eligible to replace the rules: design section 4.3 requires the curator to
prefer the model's calls, and there are no curator calls to prefer with. The shortest route to
that gate is for Scott to decide the 20 papers above on `/admin/literature` (the six
disagreements first), after which `--provider claude --dry-run` prints the two "vs curator" rates
without further code.

Cost: 20 abstracts cost well under one cent on Haiku 5.5 through the API; 90 would too. Through
Claude Code subagents the run is covered by the Max plan, as design decision 2 asks, at the cost
of the harness caveat in section 2.

## 7. Open questions for Scott

1. Which transport for the 70: an `ANTHROPIC_API_KEY` in `.env` (API billing, exact structured
   output, the code as written), or the subagent route through a Claude Code session (Max plan,
   same prompt, harness caveat)? Both record into the same transcript format.
2. Will you decide the 20 papers on the screening desk so the acceptance test in design 4.3 can
   be scored? Until then the report can only say the model beat the rules on this session's
   reading of six papers.
3. Should 4A's refusal of `--provider claude --apply-suggestions` stand until 4C's lane guard, or
   do you want local writes of model suggestions now so the desk shows them beside the rules?
