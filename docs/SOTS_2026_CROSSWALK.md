# Crosswalk: WHO/UNEP State of the Science of EDCs 2026 against EDCtox

Written 18 Nov 2026 from the launch version of the report (241 pages, read as extracted text;
chemical counts below are page counts in chapters 1–6, references and annexes excluded).
EDCtox figures are from the production database on the same day. Nothing in the database or
the ontology was changed to write this.

> United Nations Environment Programme and World Health Organization (2026). *State of the
> Science of Endocrine-Disrupting Chemicals 2026*. Nairobi. Licence CC BY-NC-SA 3.0 IGO.
> DOI [10.59117/20.500.11822/50195](https://doi.org/10.59117/20.500.11822/50195).

The licence allows non-commercial reuse with attribution, and adaptations must carry the same
licence. Anything imported from the report into EDCtox should cite it and keep that in mind.

## 1. What the report is, and is not

It is the third global assessment (2002, 2012, 2026). Six chapters: introduction; evidence in
humans and animals; testing and assessment; exposure; socioeconomic and policy analysis;
implications for decision makers. Chapter 2 is an **umbrella review**: a review of systematic
reviews, scoping reviews and evidence maps published since 2012, plus two scoping reviews of
primary literature for outcomes new since 2012 (cardiovascular disease and steatotic liver
disease).

Three consequences for EDCtox:

- **It rates evidence by health domain, not by chemical.** Figure 6.1 gives one rating per
  domain for humans and one for animals. There is no table rating chemical × outcome pairs. The
  report says explicitly that "EDC" is used as a class and that not every EDC is linked to every
  effect.
- **It cannot back a per-compound score by itself.** What it can back is a domain-level
  statement, a per-class statement, and for a handful of chemicals a specific cited finding.
- **It contains one hard list.** Annex III reproduces the chemicals the European Union has
  formally identified as EDCs, with CAS numbers, from
  [edlists.org list I](https://edlists.org/the-ed-lists/list-i-substances-identified-as-endocrine-disruptors-by-the-eu).

## 2. Health domains

The report's eight rated domains (figure 6.1), plus three it discusses without rating.

| Report domain | Humans | Animals | Where it lives in EDCtox | Gap |
|---|---|---|---|---|
| Male reproduction | Strong | Strong | `REP` profile domain (35 mechanisms); outcomes for sperm count, motility, testosterone, infertility | No cryptorchidism or hypospadias outcome |
| Female reproduction | Strong | Strong | `REP`; outcomes for PCOS, anovulation, infertility | No endometriosis, fibroids, adverse pregnancy outcome or breastfeeding-duration outcome |
| Thyroid | Strong | Strong | Five thyroid mechanisms; three outcomes filed under the neuroendocrine category | **Not a profile column.** The report treats thyroid as its own top-tier domain |
| Neurodevelopment and behaviour | Strong | Strong | One mechanism (`NEURODEVELOPMENT`) and one outcome ("Neurodevelopmental change") inside `DEV` | **Largest gap by evidence strength.** No cognition, IQ, attention or behaviour outcomes |
| Other developmental | (table 2.1: strengthened) | | `DEV` (22 mechanisms); puberty timing, anogenital distance, linear growth | No birth weight, fetal growth or preterm birth outcome |
| Metabolism | Moderate | Strong | `MET` (58 mechanisms); obesity, insulin resistance, type 2 diabetes, hepatic steatosis | Good fit. "Hepatic steatosis" should also carry the report's name, MASLD |
| Immune | Moderate | Strong | `IMM` (36 mechanisms); two outcomes | No asthma, allergy or autoimmune outcome |
| Cardiovascular | Emerging | Emerging | `VASCULAR_ENDOTHELIAL`, a non-profile domain (18 mechanisms, 5 outcomes) | No hypertension or cardiovascular mortality outcome. Non-profile status matches "emerging" |
| Cancer | Moderate | Moderate | **Nothing.** No mechanism, no outcome | Breast, prostate, thyroid and endometrial cancer are named throughout |
| Retinoid signalling | limited | strong mechanistic | Nothing | New since 2012; mechanism-level only |
| Renal | early | experimental | Nothing | New since 2012; "further research needed" |

Going the other way, two of EDCtox's seven profile columns have almost no counterpart in the
report. Mitochondria appear on 2 pages of chapters 1–6 and oxidative stress on 6, always as a
mechanism behind another outcome, never as a domain. `MITO` and `REDOX` are therefore EDCtox's
own contribution: defensible as mechanistic layers, but they are not "endocrine disruption" in
the report's sense, and the site should say so rather than present all seven columns as equals.

## 3. Chemicals

### 3.1 Overlap

51 of EDCtox's 116 compounds are named in chapters 1–6 or in the EU list. 65 are not, of which
38 are pharmaceuticals.

| | Count |
|---|---:|
| EDCtox compounds named in the report | 51 |
| EDCtox compounds not named | 65 (38 pharmaceuticals) |
| EDCtox compounds on the EU-identified list (Annex III) | 10 |
| Scored EDCtox compounds named in the report | 6 of 16 |

The six scored compounds the report discusses are BPA (52 pages), DEHP (20), PFOS (11), and
in passing fluoxetine, melatonin and paraquat. The ten scored compounds it never mentions are
bixafen, boscalid, fluopyram, fluxapyroxad, methylphenidate, olanzapine, risperidone, rotenone,
TFA and valproate. Valproate, antipsychotics, SDHI fungicides, TFA and isoxazolines appear
nowhere in the report.

### 3.2 What the report discusses most that EDCtox has but has not scored

PCBs (31 pages, class placeholder), BPS (19), tributyltin (16), atrazine (14), DDT (12),
parabens (12, class placeholder), PFOA (11), BPF (10), DBP (9), DDE (7), vinclozolin (7),
chlorpyrifos (6), PFNA (5), PFHxS, BBP, BPAF, TBBPA, TDCIPP and triphenyl phosphate.

### 3.3 What the report names that EDCtox does not have at all

Triclosan (12 pages, and one of the eight "EDCs in focus"), nonylphenols and octylphenol
(11 and 6; also in focus and most of the EU list), TCDD as a specific compound (EDCtox has a
dioxin-like class placeholder only), PAHs (10), cadmium (7), mercury (6), endosulfan (5),
benzophenone-3 as a specific compound (5), perchlorate (4), lindane (4), genistein and other
phytoestrogens (4), diethylstilbestrol (3), 4-methylbenzylidene camphor (in focus),
butylparaben and propylparaben as specific compounds, methoxychlor, arsenic, linuron and
flutamide.

### 3.4 The eight "EDCs in focus" (section 4.4)

Bisphenols (BPA, BPS, BPF); PCBs; nonylphenols; phthalates; triphenyl phosphate; pesticides;
4-methylbenzylidene camphor; triclosan. EDCtox has specific records for the bisphenols,
phthalates, triphenyl phosphate and many pesticides; a placeholder for PCBs; and nothing for
nonylphenols, 4-MBC or triclosan.

### 3.5 The EU-identified list (Annex III)

About 130 rows, most of them alkylphenol and nonylphenol-ethoxylate variants. The EDCtox
compounds on it are BPA, BPS, BPB, DEHP, DBP, BBP, DIBP, triphenyl phosphate, mancozeb and
propiconazole. This is the single most importable item in the report: each row is a regulatory
fact with a CAS number and a public source, and EDCtox's `RegulatoryAssessment` table, which has
a conclusion kind for exactly this (`ED_CONCLUSION`), currently holds zero rows.

### 3.6 Chemical-outcome pairs with numbers (table 5.1)

The cost-of-illness table is the report's only chemical × outcome grid. It pairs, with cited
studies and life stage of exposure: PBDE-47 with IQ loss and cryptorchidism; organophosphate
pesticides with IQ loss; DDE with childhood obesity, type 2 diabetes and fibroids; DEHP with
adult obesity, type 2 diabetes and endometriosis; BPA with childhood obesity; phthalates with
male infertility and cardiovascular mortality; and PFAS with low birth weight, childhood and
adult obesity, pneumonia, gestational diabetes, infertility, hypothyroidism, type 2 diabetes,
endometriosis, PCOS and breast cancer. These are attributable-burden estimates from one
research group's method, not consensus causal ratings, and should be stored as such.

### 3.7 Regrettable substitution (section 4.5)

Named chains: BPA to BPS and BPF; PFOA to GenX; brominated flame retardants to
organophosphate ones; phthalates to DINCH; parabens to triclosan to chlorhexidine. EDCtox's
`CompoundRelationship` table already models replacement. These chains are the report's
strongest argument for why the unscored analogue rows in EDCtox matter.

## 4. Scientific framework

| Report | EDCtox today | Assessment |
|---|---|---|
| WHO/IPCS definition: endocrine activity, an adverse effect, and a plausible link between them | Mechanism assessments, outcome assessments, and `CausalPathway` | **Same three-part shape.** The phase 4 design's decision that outcomes carry the headline matches "adverse effect in an intact organism" |
| Ten key characteristics of EDCs (KC1 receptor agonism to KC10 cell fate); explicitly not a checklist or a count | No key-characteristic field; `ExternalOntologyMapping` is empty | Tag each endocrine mechanism with its KC. Cheap, and it is the vocabulary regulators now use |
| Adverse outcome pathways; over 100 endocrine AOPs in AOP-Wiki, several OECD-endorsed (25, 23, 42, 54 and others) | `CausalPathway` exists with six rows; AOP mapping deferred to phase 4E | Bring forward for the endorsed AOPs only |
| Hazard is not risk | "Not a toxicity rank and not a human-risk number" | Already aligned |
| Evidence integration by stream (SYRINA, IARC-style): human, animal, mechanistic, then integrated | `evidenceClass`, confidence, and H0–H4 human relevance | Aligned in spirit. Consider showing the three streams separately per assessment |
| Risk of bias includes funding and conflict of interest; the Klimisch method is criticised for favouring guideline studies | Study quality sub-scores; optional Klimisch code; no funding or conflict field | Add a funding-source field before literature extraction starts in earnest |
| Strength words: strong, moderate, emerging | Five confidence levels | Keep EDCtox's; publish the mapping |
| Non-monotonic dose response; no assumed threshold | A dose-response field on assessments | Aligned; unused so far |
| Critical windows (embryonic, fetal, pubertal); latent effects | Thirteen life stages on exposure contexts | Aligned, and a strength |
| Mixtures and co-exposure | `CompoundInteraction`, formulations | Aligned in schema; one row of data |
| EATS-only testing leaves most pathways uncovered | Mechanisms well beyond EATS | A strength worth stating on the methodology page |
| One Health: wildlife and invertebrate evidence | Human-centred; species is free text | Out of scope unless chosen |

## 5. What this means

1. **EDCtox's structure agrees with the report; its content does not yet overlap with it.** The
   three-criteria definition, hazard versus risk, life stage, replacement chemicals and
   mechanism-before-outcome are all already how EDCtox is built. But ten of the sixteen scored
   compounds are ones the report never mentions, and the chemicals it discusses most are
   unscored or missing.
2. **The site covers two different things under one name.** One is endocrine disruptors in the
   report's sense. The other is mitochondrial and metabolic harm from drugs and newer
   pesticides (valproate, olanzapine, SDHIs, TFA). The second is not wrong and may be the more
   original half, but the report gives it no support, so it needs its own framing and its own
   evidence.
3. **Three ontology gaps are confirmed by a "strong" or "moderate" rating:** neurodevelopment
   and behaviour outcomes, thyroid as a first-class domain, and cancer. Cardiovascular is
   correctly non-profile for now.
4. **Two things can be imported with no model judgement:** the EU-identified list as
   regulatory rows, and the report itself as a cited source for domain-level and class-level
   statements.

## 6. Proposed work, in order

Each item is small and stops for review.

- **A. Regulatory layer.** Add the report and edlists.org as `EvidenceSource` and
  `ExternalDataset` records; write a `RegulatoryAssessment` row for each of the ten EDCtox
  compounds on the EU list; show it on the compound page. Run the existing PubChem identity
  resolver on production for the scored compounds in the same pass.
- **B. Add the missing in-focus chemicals as unscored records:** triclosan, 4-nonylphenol,
  4-tert-octylphenol, 4-MBC, TCDD, benzophenone-3, butylparaben, propylparaben, perchlorate.
  Seed files only; no scores.
- **C. Ontology migration (expand-only).** Outcomes: endometriosis, uterine fibroids,
  cryptorchidism, hypospadias, low birth weight, preterm birth, cognitive and IQ outcomes,
  attention and behaviour outcomes, asthma and allergy, hypertension, and the four
  hormone-related cancers. A key-characteristic tag on mechanisms. A decision on thyroid
  (section 7).
- **D. Report-backed statements on pages.** A "What the 2026 WHO/UNEP assessment says" block on
  each compound page, at class or compound level, with page references, kept visibly separate
  from EDCtox's own scores. Also record the regrettable-substitution chains as relationships.
- **E. Resume the literature pipeline** (phase 4), starting with the compounds the report
  discusses most and EDCtox has not scored: BPS, BPF, PFOA, DBP, atrazine, chlorpyrifos, DDT
  and DDE, tributyltin, triclosan.
- **F. Presentation.** Default index shows compounds with content; per-page titles; a home
  page that states the two scopes in section 5.2.

## 7. Decisions for Scott

1. **Scope.** One site with two labelled tracks (endocrine disruptors; mitochondrial and
   metabolic harm including pharmaceuticals), or narrow to the report's sense of EDC?
2. **Thyroid.** Promote to an eighth profile column, or keep it inside neuroendocrine and add
   a visible thyroid sub-headline?
3. **Cancer.** Add as outcomes only (recommended, matching "moderate" evidence and the outcome
   layer), or also as a mechanism domain?
4. **Table 5.1 burden estimates.** Store and show them as attributed cost estimates, or leave
   them out because they are one group's method?
5. **Order.** A to F as written, or the literature pipeline first?

## 8. Decisions and revised order (20 Nov 2026)

Sections 6 and 7 were a working draft. This section replaces them.

### Decided

1. **Scope: one site, two labelled tracks.** Expansive: pollutants and drugs with
   endocrine-disrupting potential. Track one is endocrine disruption in the report's sense.
   Track two is mitochondrial and metabolic harm, including pharmaceuticals. The site says
   which track a compound and a column belong to.
2. **Thyroid becomes its own profile column**, the eighth.
5. **The pipeline is the centre of the work.** The aim is to populate the database with as
   little human involvement as possible (see the 25 Oct decisions in
   `AGENT_PIPELINE_DESIGN.md`).

### Proposed, awaiting a yes

3. **Cancer by the middle road.** No cancer domain and no cancer column. Add the four
   hormone-related cancers as outcomes. Add the few mechanisms that have no home today
   (proliferation, epigenetic reprogramming, DNA damage, mammary gland development) inside
   existing domains. Link existing endocrine mechanisms to those outcomes with `CausalPathway`
   rows, starting from pathways already published in AOP-Wiki, so a reader can go from an
   outcome down to mechanisms and their claims.
4. **Leave the burden estimates out.** They describe a population's exposure in one place and
   year, which is a risk figure, and EDCtox states that it does not publish risk figures. A
   link from the methodology page is enough.

### Order of work

Each step stops for review. Steps 1 and 2 come first because the pipeline maps every claim to
a mechanism or outcome, and a claim with nowhere to land is wasted: ten of the seventeen BPA
claims are already unmapped.

**Status, 20 Nov 2026: steps 1, 2 and 3 are done and live on edc.fyi.** Step 4 is next and
waits on Scott, because phase 4A asks three questions only he can answer. What landed:

| | Before | After |
|---|---:|---:|
| Profile columns | 7 | 8, thyroid added |
| Compounds | 116 | 125 |
| Outcomes | 42 | 59 |
| Mechanisms | 273 | 280 |
| Regulatory rows | 0 | 14, each linking to its source |
| External identifiers | 0 | 6, for BPA and PFOS |
| Mechanism assessments | 71 | 71, unchanged as intended |
| Tests | 86 | 96 |

One bug surfaced while verifying step 3 and is fixed. The public data cache was keyed on the
commit SHA, which a redeploy does not change, so a seed or identity write made after a deploy
could keep serving stale pages for a day. The key is now the deployment id.

1. **Ontology migration (expand-only, one migration).** Thyroid as a profile domain, with the
   five thyroid mechanisms moved under it and the three thyroid outcomes recategorised. The
   missing outcomes from section 2. The cancer middle road. A key-characteristic tag on
   mechanisms. Track labels on domains. Scoring tests updated so the 71 assessments are
   unchanged except where a thyroid assessment moves column.
2. **Compound records the pipeline needs.** Unscored seed records for the report's in-focus
   chemicals that are missing (section 3.3).
3. **Deterministic importers, built as pipeline lanes.** No model involved, fully repeatable:
   the EU-identified list into `RegulatoryAssessment`, and the existing identity resolver run
   on production. These give pages cited content immediately and exercise the production write
   guard before any model writes through it.
4. **Merge phase 4A, then build 4B (the extractor).** 4A's three open questions are answered
   first: transport, the 20 curator decisions, and whether model writes wait for 4C.
5. **Breadth (4C) over the report's compounds.** Query generation per compound and domain,
   starting with the chemicals the report discusses most and EDCtox has not scored: BPS, BPF,
   PFOA, DBP, atrazine, chlorpyrifos, DDT, DDE, tributyltin, triclosan.
6. **Proposals and the auto-accept lane (4D)**, as decided on 25 Oct: machine revisions, the
   snapshot guard, one-command rollback.
7. **Presentation.** Default index shows compounds with content; per-page titles; a home page
   that states the two tracks.

Report-backed statements on compound pages, step D of the old draft, fold into step 3 as a
second deterministic lane once the regulatory rows exist.
