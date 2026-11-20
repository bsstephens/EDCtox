# Screening without a curator in the loop

Written 20 Nov 2026. Replaces the screening half of `AGENT_PIPELINE_DESIGN.md` sections 4.3
and 4.4. The extraction, proposal and audit stages are unchanged in intent.

## Why the current design needs a human

A screening decision is keyed on publication × compound × domain. That was right for one
compound and one domain. At 125 compounds and 8 profile columns it is up to a thousand
decisions per paper, so the only way to trust it is for a curator to set a gold standard and
keep checking. That is the bottleneck, and it is a design problem rather than a staffing one.

Two other costs follow from the same key. The same abstract is read again for every context,
so model spend grows with compounds × domains rather than with papers. And adding a compound
invalidates nothing but re-opens every paper, because no stored row says what the paper was
about.

## The observation this turns on

Almost everything a screening decision records is a property of the **paper**, not of the
context it was screened in. Taking the reason codes already in the schema:

| Reason code | Depends on |
|---|---|
| `NARRATIVE_REVIEW_ONLY`, `SYSTEMATIC_REVIEW`, `META_ANALYSIS`, `COMMENTARY_OR_EDITORIAL` | the paper alone |
| `IN_VITRO_ONLY`, `ANIMAL_ONLY`, `DIRECT_HUMAN_EVIDENCE` | the paper alone |
| `RETRACTED`, `DUPLICATE_PUBLICATION`, `METHOD_ONLY` | the paper alone |
| `WRONG_COMPOUND`, `WRONG_BISPHENOL` | which compounds the paper studies |
| `WRONG_DOMAIN`, `NON_RELEVANT_OUTCOME` | which outcomes the paper reports |
| `EXPOSURE_ONLY` | whether it measures an outcome at all |

Only the last three are contextual, and each is derivable from one more paper-level fact. So a
paper should be read **once**, what it is about recorded on it, and every context derived from
that. Reading is per paper. Routing is free.

## The layers

**Layer 0: provider metadata. No model, no guessing.**

PubMed already states much of what the keyword rules were inferring. The parser fetches
`<PublicationType>` today and discards it; MeSH headings are not read at all.

- `<PublicationType>` gives review, systematic review, meta-analysis, randomised controlled
  trial, comment, editorial, retracted publication. That is `sourceType` and four reason codes,
  stated by the provider rather than inferred from a title.
- MeSH descriptors give species (`Humans`, `Animals`, `Rats`), which answers human versus animal
  without reading the abstract.
- MeSH substance headings and registry numbers give the compounds the indexers assigned, which
  is an independent check on compound identity. "Bisphenol A" and "bisphenol S" are separate
  headings, which is exactly the distinction the rules kept getting wrong.
- Europe PMC gives open access and full-text availability.

This layer is deterministic, free, repeatable, and testable against fixtures. It should run
before any model sees the paper. Where PubMed has not indexed a paper yet, the fields are null,
which is honest and different from "assessed and found not to be a review".

**Layer 1: one model read per paper, ever.**

A Haiku pass over title and abstract produces a structured paper profile:

- compounds actually studied, by name, with the class where the paper studies a class
- outcomes and endpoints reported, in the paper's own words
- study design beyond what the publication type says: species, exposure route, life stage
- whether an outcome was measured at all, or only exposure
- what the paper is not about, where the title would mislead

Stored on `EvidenceSource`, not on a context row. Versioned by prompt, so a better prompt
re-reads papers deliberately rather than by accident.

**Layer 2: routing. Deterministic, free, re-runnable.**

Given a profile, the contexts follow mechanically: map named compounds to compound records by
alias and registry number, map named outcomes to outcome and mechanism codes, and emit a
context row for each pair. A paper enters BPA × reproductive because the profile says it
studies bisphenol A and reports a reproductive outcome, not because a model was asked that
question.

Adding a compound re-runs routing over stored profiles at zero model cost. That is the
property the current design lacks.

An outcome the ontology has no code for becomes an `OntologyGap` row rather than being dropped.
That is how the ontology learns what it is missing, and it is the signal that matters most
while coverage is thin.

**Layer 3: extraction.** Opus, only for papers that routed somewhere. Unchanged from the
existing design.

**Layer 4: audit.** Opus over a sample, adversarially. Unchanged in intent.

## What replaces the curator as the quality signal

This is the part that deserves scepticism, so it is stated plainly. A human gold standard is
better than everything below. These are what can be had without one.

1. **Agreement with provider metadata.** Every paper carries free structured facts, so every
   model profile can be checked against them automatically and continuously. If the profile
   says human study and MeSH says `Animals` with no `Humans`, that is a flag, not a judgement
   call. If the profile names bisphenol A and the substance headings carry only bisphenol S,
   that is a flag. This is a real gold standard for the subset of facts PubMed indexes, it
   covers every paper rather than a sample, and it costs nothing.
2. **Adversarial audit.** A stronger model re-reads a sample and is asked to disagree, with the
   disagreement rate tracked over time rather than treated as a pass mark.
3. **Stability.** The same paper, the same prompt version, twice, should give the same profile.
   Drift is a defect.
4. **Routing sanity.** A paper that routes to more than a few domains, or to none, is suspect.
   Both are cheap to detect and worth a human glance when they cluster.

What none of this gives is a check on the judgements PubMed does not index: whether a stated
outcome is really in the reproductive domain, whether a claim is directly demonstrated or
inferred. Those stay uncertain until someone looks. The honest position is that the pipeline
can run unattended and report its own confidence, and that a curator spot-check makes it
better whenever one happens, without being the thing that unblocks it.

## Cost

One Haiku read per paper, plus one Opus extraction for papers that route somewhere, plus an
audit sample. Ninety papers is cents rather than dollars. The figure that matters is that cost
now grows with papers, not with papers × compounds × domains.

## What changes in the schema

Expand-only, and none of it touches scoring.

- `EvidenceSource` gains the provider metadata from layer 0: publication types, MeSH descriptors
  and substance headings, and the indexing date. `sourceType` stops being `UNSPECIFIED` when
  the provider has stated it.
- A `PaperProfile` row, one per publication per prompt version, holding layer 1.
- `LiteratureScreeningDecision` keeps its shape and its curator columns, and its machine side
  becomes derived rather than asked. A curator decision still overrides, and still wins.

## Submission from the web interface

The same layers answer the feature worth building: a paper submitted through the site enters at
layer 0 with its identifier, runs layers 1 and 2, and the submitter is shown what it was read
as before anything is stored as a candidate.

"How does this paper reinforce or challenge what is already recorded" is layer 3 plus a
comparison against existing assessments on the routed contexts: agreement, contradiction, or a
mechanism the ontology does not yet hold. That is the proposal stage with its output shown
rather than queued, and it is the most useful thing the pipeline could expose.

It needs two things that are already listed as prerequisites in the pipeline design: admin
authentication, and an API key rather than a subscription, because a subscription cannot serve
a web request. The same auth unlocks the curator queues on production.

A public-facing agent also needs a hard grounding rule: answer only from stored rows, cite the
row, and decline anything that asks it to convert a score into a risk statement. The database
is built to refuse that framing and an ungrounded agent would hand it over in one sentence.

## Open questions

1. Is paper-level profiling plus deterministic routing the right replacement for contextual
   screening, or is there a case for keeping a contextual model pass for the hard contexts?
2. Should layer 0 block layer 1 when PubMed has not indexed a paper, or should the model read
   it anyway and the metadata check be skipped?
3. Is the provider-agreement check above enough to run unattended for now, with spot-checks
   when Scott wants them, rather than before anything can proceed?
