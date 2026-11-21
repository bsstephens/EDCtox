# Outcome direction audit

Prompted by two glyphosate sources Scott raised on 21 Nov 2026:

- The NIEHS systematic review ordered by HHS, published in *Environment International*,
  November 2026: 55 animal studies, high confidence that glyphosate and glyphosate-based
  herbicides reduce sperm count and motility, increase abnormal sperm morphology, and lower
  testosterone, with effects reported at doses overlapping the EFSA ADI and the EPA reference
  dose.
- The Ramazzini Institute pilot phase of the Global Glyphosate Study, 2019: at the US reference
  dose of 1.75 mg/kg/day, a statistically significant **increase** in anogenital distance in
  males and females, delayed first estrous, **increased** testosterone in females, and altered
  gut microbiota before puberty.

Glyphosate is a good test of the ontology because it runs the other way from the compounds the
ontology was built around. Phthalates are anti-androgenic and shorten anogenital distance;
glyphosate-based herbicides lengthen it. A vocabulary built from one direction cannot record the
other.

## What the audit found

Of 65 outcomes, 24 have a direction in the name. Before this change, exactly one concept —
puberty — held both directions. The other 23 held one.

That is mostly correct, and the structural reason is worth stating: **mechanisms are named as
entities and processes, with direction carried on the assessment, while outcomes have direction
baked into the name.** So the mechanism side has no asymmetry to audit. `ANOGENITAL_DISTANCE`,
`PUBERTY_TIMING`, `OVULATION`, `ANDROGEN_RECEPTOR_AGONISM` and `TESTOSTERONE` all already cover
glyphosate's findings whichever way they run.

## Added

Three concepts where both directions are adverse and documented, so a one-sided vocabulary made
real findings unrecordable:

| Added | Mirror of | Why |
|---|---|---|
| `INCREASED_ANOGENITAL_DISTANCE` | `REDUCED_ANOGENITAL_DISTANCE` | The androgenic direction, reported for GBHs at the US reference dose. The existing row is the anti-androgenic direction phthalates show. |
| `ELEVATED_TESTOSTERONE` | `REDUCED_TESTOSTERONE` | Adverse in females and part of the PCOS phenotype. The same compound lowers it in males and raises it in females, so one row could not hold both findings. |
| `EARLY_MENARCHE` | `DELAYED_MENARCHE` | One of the better-documented endocrine-disruption outcomes, and its mirror was here alone. Added from the audit rather than from a single paper. |

Both directions are kept as **separate rows**, not folded into one neutral "altered" row. The
direction is the scientific content: a longer anogenital distance is androgenic and a shorter one
anti-androgenic, and those are opposite mechanisms rather than one finding. `ALTERED_TSH` is the
neutral pattern and is right for TSH, where the assay is a regulatory readout rather than a
direction of harm; it is the wrong pattern here.

A test in `src/server/scoring/ontologyExpansion.test.ts` pins these pairs, so half a pair cannot
be deleted later without the suite saying so.

## Left one-sided on purpose

For most of the remaining concepts the single direction *is* the adverse one, and its opposite
would be noise in an evidence index. Nobody records rising sperm motility, improving cognition or
a higher IQ as a finding: `REDUCED_SPERM_COUNT`, `REDUCED_SPERM_MOTILITY`, `REDUCED_SEMEN_VOLUME`,
`ABNORMAL_SPERM_MORPHOLOGY`, `REDUCED_FECUNDABILITY`, `REDUCED_ART_SUCCESS`, `REDUCED_IQ`,
`IMPAIRED_COGNITION`, `IMPAIRED_GLUCOSE_TOLERANCE`, `IMPAIRED_VASODILATION`,
`REDUCED_ANTIBODY_RESPONSE`, `INCREASED_INTESTINAL_PERMEABILITY`, `HYPERTENSION`,
`HYPERINSULINEMIA`, `HYPERPROLACTINEMIA`, `LOW_BIRTH_WEIGHT`, `REDUCED_LINEAR_GROWTH`.

## Open decisions

Three asymmetries where a case exists but I would not add a row without Scott's call:

| Add? | Concept | Present | Missing | The case |
|---|---|---|---|---|
| | Thyroid hormone | `REDUCED_T4`, `HYPOTHYROIDISM` | elevated T4, hyperthyroidism | Most EDC thyroid evidence is the lowering direction, but hyperthyroid effects are reported. `ALTERED_TSH` already covers TSH neutrally. |
| | Appetite | `REDUCED_APPETITE` | increased appetite | Relevant to obesogens, where increased intake is the mechanism of interest. `WEIGHT_GAIN` may already carry what matters. |
| | Birth weight | `LOW_BIRTH_WEIGHT` | high birth weight | Macrosomia is reported for some exposures, far less often than low birth weight. |

## Where glyphosate itself stands

Both compounds already exist: `glyphosate` and `glyphosate-based-herbicide`, as `HERBICIDE`.
That distinction matters for this evidence and the ontology already makes it — the NIEHS review
assessed the active ingredient and the commercial formulations separately and found the same
effects in both, which is the basis for its conclusion that glyphosate itself drives them.

Neither compound has any mechanism assessment, outcome assessment, claim or screening decision
yet. Nothing in this change adds evidence for glyphosate; it makes the findings above
expressible. Running the pipeline for glyphosate would be a separate decision, and the first
real test of a non-BPA compound end to end.

One boundary worth recording rather than treating as a gap: IARC classifies glyphosate as a
probable human carcinogen, and the cancer the epidemiology concerns is non-Hodgkin lymphoma. The
`CANCER` outcome category is explicitly hormone-related cancers, so that classification is out of
scope by design, not missing.
