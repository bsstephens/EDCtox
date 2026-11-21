# Claim synonym proposals

Status: **decided and applied, 21 Nov 2026.** Scott accepted sections 1 and 3, rejecting the
sperm count row in section 1. Section 2's three judgment calls were not accepted and remain
unmapped. The accepted rows live in `src/data/seeds/claimSynonyms.ts`, one entry each, traceable
back to the tables below.

Applied with `npm run literature:claims:remap`, which re-resolves stored claims from the current
ontology and synonym table without re-reading a paper. Model claims with an ontology link went
from 34 of 230 to **67 of 230**. The rule-based extractor's claims were left alone: its narrower
mapping decisions are deliberate and are the only baseline there is to compare against.

**One correction to section 3 below.** It said there is no scorable ERα node. That was wrong. The
ontology holds `ER_ALPHA_AGONISM` and `ER_ALPHA_ANTAGONISM`, which my search missed because
neither the code nor the name "ER-alpha agonism" contains "estrogen" or "ESR". The ontology
models the receptor as *actions*, which is the better design: binding, agonising and changing how
much receptor is present are different mechanisms. The real gap was narrower -- a claim about ERα
*abundance* had nowhere to point -- and `ER_ALPHA_EXPRESSION` and `ER_BETA_EXPRESSION` were added
for it. A claim that BPA *binds* ERα is deliberately left unmapped: which of the two it supports
is exactly what a curator should decide.

The model-backed extractor has written 217 claims across 40 BPA reproductive papers. 33 carry an
ontology link; 184 do not. This proposes what to do about the 184, as a list of decisions rather
than a threshold, because every one of them is a scientific judgment about whether two phrases
name the same thing.

## What the unmapped set actually looks like

I told Scott this would convert "a large share" of the 184. It will not, and the shape of the
data is the reason. The 184 claims are **167 distinct terms, nearly all appearing once**:

| Term type the model assigned | Claims | Distinct terms |
|---|---:|---:|
| PHENOTYPE | 40 | 38 |
| OUTCOME | 24 | 23 |
| CELLULAR_PROCESS | 21 | 15 |
| GENE | 18 | 18 |
| CELL | 17 | 15 |
| PHYSIOLOGICAL_PROCESS | 15 | 13 |
| BIOMARKER | 15 | 14 |
| PROTEIN | 11 | 10 |
| everything else | 23 | 21 |

A long tail of one-off phrases is not a synonym problem. Most of these terms are the specific
measure one paper happened to report, and there is no second paper to share a synonym with.

Realistically: **section 1 converts about 25 claims, section 3 about 20 more if you add the
rows.** The remaining ~140 should stay unmapped, and section 4 says why that is the right
outcome rather than a failure.

---

## 1. Synonyms of nodes you already have

Each row proposes that a term means an existing node. These are the ones I am confident about:
the term and the node name are the same entity in different words, not a near neighbour.

| Accept? | Term as written | Claims | Proposed node |
|---|---|---:|---|
| accepted | `testosterone (t)`, `testosterone level` | 2 | `TESTOSTERONE` (mechanism) |
| accepted | `superoxide dismutase (sod)` | 1 | `SOD` (mechanism) |
| accepted | `follicle-stimulating hormone (fsh)`, `day-3 follicle stimulating hormone levels (fsh)` | 2 | `FSH` (mechanism) |
| accepted | `luteinizing hormone` | 1 | `LH` (mechanism) |
| accepted | `male fertility`, `female fertility` | 2 | `FERTILITY` (mechanism) |
| accepted | `testicular germ cell apoptosis` | 1 | `APOPTOSIS` (mechanism) |
| accepted | `ovarian reserve markers`, `ovarian reserve parameters in women`, `impaired ovarian reserve`, `reduce ovarian reserve`, `antral follicle count (afc)`, `reduced antral follicle counts or oocyte yield` | 6 | `OVARIAN_FOLLICLE_RESERVE` (mechanism) |
| **rejected** | `total sperm count`, `sperm concentration`, `epididymal sperm concentration` | 7 | `REDUCED_SPERM_COUNT` — rejected: these are different measurements and stay unmapped |
| accepted | `progressive motility` | 1 | `REDUCED_SPERM_MOTILITY` (outcome, on a decrease only) |
| accepted | `endometriosis-like lesions` | 1 | `ENDOMETRIOSIS` (outcome) |
| accepted | `epithelial ovarian cancer (eoc)` | 1 | `OVARIAN_CANCER` (outcome) |
| accepted | `mitochondrial impairment` | 2 | `MITOCHONDRIAL_DYSFUNCTION` (outcome) |

**One thing to check in the sperm count row.** `sperm concentration` and `total sperm count` are
not the same measurement — concentration is per millilitre, total count is concentration times
volume — and a paper can report a fall in one without the other. Folding both into
`REDUCED_SPERM_COUNT` is defensible for an evidence index and wrong for a meta-analysis. It is
the single row here I would most expect you to reject.

## 2. Judgment calls I will not make for you

| Accept? | Term | Claims | Candidate node | The problem |
|---|---|---:|---|---|
| not accepted | `oxidative stress`, `elevated oxidative stress` | 4 | `OXIDATIVE_DAMAGE` | Stress is the imbalance, damage is its consequence. Papers use them loosely; the ontology should probably not. |
| not accepted | `epigenetic regulation` | 2 | `EPIGENETIC_PROGRAMMING` | "Programming" implies a developmental window. "Regulation" does not. |
| not accepted | `decreased anoclitoral distance in infants` | 1 | `ANOGENITAL_DISTANCE` | Anoclitoral distance is the female measure; AGD usually denotes the male one. Related, not identical. |

## 3. Gaps where no node exists

These are not synonym problems. The literature reports them and the ontology has nowhere to put
them, so the fix is a new row, which is a decision about scope rather than vocabulary.

| Add? | Missing concept | Claims | Note |
|---|---|---:|---|
| ~~added~~ | **Estrogen receptor alpha abundance** | 5 | ~~There is no scorable ERα node.~~ **Wrong, see the correction above:** `ER_ALPHA_AGONISM` and `ER_ALPHA_ANTAGONISM` exist and are scorable. What was missing was a node for how much receptor is present, now `ER_ALPHA_EXPRESSION` / `ER_BETA_EXPRESSION`. `estrogen receptors` stays unmapped as ambiguous between α and β. |
| added `AMH` | Anti-Müllerian hormone | 4 | A standard ovarian reserve marker: `anti-müllerian hormone (amh)`, `serum amh levels`, `e2, p4 and amh level`. |
| added two | IVF outcomes | 6 | `clinical pregnancy rates`, `fertilization rates`, `time to pregnancy (ttp)`, `subfertility`. Arguably one outcome, arguably four. |
| added `ABNORMAL_SPERM_MORPHOLOGY` | Sperm morphology | 2 | `abnormal sperm morphology`, `sperm normal morphology rate`. You have count and motility but not morphology, which is the third leg of a semen analysis. |
| added `REDUCED_SEMEN_VOLUME` | Semen volume | 1 | `semen volume`. |
| added `CARDIOVASCULAR_DISEASE` | Cardiovascular disease | 1 | `cardiovascular disease (cvd)`. `HYPERTENSION` is not a substitute. |

If ERα is added, note it needs a scorable node under the existing axis rather than a change to
the axis itself, so the grouping stays a grouping.

## 4. What should stay unmapped, and why that is correct

About 140 claims. Forcing these onto a node would put noise into the index, so they are listed
here as a deliberate decision rather than an unfinished job.

- **Assay readouts, not biology.** `luciferase activity`, `all nine key targets`,
  `310 overlapping targets between bpa and pcos`. The last two are docking-study artefacts: the
  claim is about a computational result, not an entity.
- **Species-specific measures.** `cloacal index`, `cloacal foam secretion frequency` from the
  quail study, `maturation profile` from the copepod study. Real findings with no counterpart in
  a human-oriented ontology.
- **Gene symbols outside a 280-node ontology.** `TRIM25`, `UGT2B15`, `CASP3`, `RPS6KA3`,
  `NR6A1`, `PPID`, `IKBKG`, `BID`, `AR`, `SF1`, `DDIT4`, `SULT1E1`, `POMC`, `SOMATOSTATIN`,
  `GPER30`. Adding a node per gene would turn a mechanism ontology into a gene list. `AR` and
  `GPER30` are arguably worth nodes on their own merits; the rest are panel members.
- **Too vague to be a claim target.** `hormone disorders`, `endocrine function`,
  `protein profile changes`, `several endocrine disorders including female and male
  infertility, precocious puberty, hormone dependent tumours such as breast and prostate
  cancer` — that last one is a whole review's abstract compressed into one object.
- **Grouping nodes, refused by design.** `steroidogenesis` and `steroidogenic enzymes` match
  `REP_STEROIDOGENESIS`, which is `GROUPING_ONLY`. The claim is genuinely about the group, and
  the rule that groups are display nodes rather than claim targets is doing its job. Nothing to
  change unless that rule changes.

---

## How to answer

Answered: "sections 1 and 3, skip the sperm count row". Accepted synonyms become a curated crosswalk file beside
`src/data/seeds/meshCrosswalk.ts` — explicit pairs, no string similarity, each one traceable to
this document. New ontology rows ship as an expand-only migration with their seed data.

Two things were needed to apply this safely, and both came out of trying. The remap must never
clear a mapping it cannot verify: its first run would have wiped 15 good mappings, because those
were made from the object's head and rows written before `machineObjectHead` existed do not
record it. And the head is now stored, so a later remap can resolve those claims on their own
merits rather than having to trust them.

The remaining 163 unmapped model claims are the long tail of section 4: one-off measures, assay
readouts and gene symbols. Nothing further is proposed for them.
