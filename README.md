# EDCtox

A research database for comparing pharmaceuticals, pesticides, plastic chemicals, PFAS, flame retardants, hormones, and other biologically active compounds across endocrine, developmental, immune, metabolic, mitochondrial, and redox mechanisms.

Scores summarise biological direction and magnitude. They are not a toxicity rank and they are not a human-risk number.

The unit of record is:

**compound × exposure context × biological context × mechanism or outcome × evidence finding**

## Schema review

These choices were made so later evidence can be added without flattening the science or redesigning the tables for auth.

- **No toxicity total.** Domain headlines are computed when a page is read. They are not stored on `Compound`.
- **`effectScore` is nullable.** A mechanism can be recorded without a number. Physiological activity (melatonin at MT1/MT2) is not stored as +4 disruption. A range that crosses zero (melatonin and metabolism) stays unscored.
- **Direction, magnitude, confidence, and human relevance are separate.** The sign of the score is not asked to carry “context-dependent”, “physiological”, or “how sure are we”.
- **`compoundType` and the boolean flags both exist.** Melatonin is a hormone, a pharmaceutical, and endogenous. One enum cannot say that.
- **`primaryCategory` is free text.** “SSRI” and “SDHI fungicide” are not the same axis as `CompoundType`.
- **Mechanisms and outcomes are different tables**, even when a name matches (insulin resistance). A signalling node is not a clinical diagnosis.
- **`aggregationGroup` is not the same thing as `parentMechanismId`.** The parent is for display. The group is the anti-double-count key. Complex I and complex II share a display parent and do not share a group, so an SDHI is not collapsed into rotenone.
- **`scorePolicy = RESEARCH_ONLY` on reorganization energy.** That row exists. It does not enter a headline, and ATP or oxygen changes are not treated as Marcus-theory evidence.
- **The exposure domain does not contribute a profile column.** Co-formulants, mixtures, and developmental window stay contextual.
- **`assessmentKey` is required.** Postgres treats NULLs as distinct in unique indexes, so a nullable exposure id alone could duplicate the default assessment.
- **`EvidenceSource` is not scored.** `EvidenceFinding` is. One source can support several findings. `countsAsScientificEvidence = false` keeps the phase-1 structural seed row from being counted as literature.
- **`relevanceScore` on a finding is not the H0–H4 scale.** It is how directly that finding bears on the linked assessment.
- **`CausalPathway` can cross domains.** The profile still shows each domain. The note says they are not added.
- **Thyroid mechanisms were added** (`TSH`, `THYROID_HORMONE`, `THYROID_RECEPTOR`) so TFA and later amiodarone are not forced into an estrogen-receptor row.
- **`User` is a side table.** Scientific rows do not require it. `AssessmentRevision.changedByUserId` is the only scientific-adjacent foreign key, and it is nullable. `externalAuthId` is there for later Clerk or Supabase Auth.
- **JSON is only unstructured supplements and assessment-revision snapshots.** Searchable scientific fields stay columns. Exact measurements, when curated, are rows on `EvidenceMeasurement`, not JSON. An inequality such as p &lt; 0.05 stays in the finding text. An exact p-value can be a decimal.
- **Biological context is a shared lookup.** Organ, tissue, cell type, and subcellular compartment can differ for the same compound and mechanism. A missing context means the place was not recorded. It does not mean whole organism.
- **Sex is an enum plus optional detail.** Species stays the reported string, with an optional common name and NCBI taxonomy id. There is no species lookup table.
- **Study quality is on the finding.** Evidence confidence is on the assessment. Seed findings stay `NOT_ASSESSED`.
- **Dose metric type is not a converted dose.** Prescribed dose, administered dose, dietary concentration, and environmental concentration are different kinds of number. Existing contexts name the kind. They do not invent a numeric dose.
- **A formulation is its own record.** A glyphosate-based herbicide shell contains glyphosate, and glyphosate is an active ingredient of that shell. Findings are not copied across.
- **`MetabolicTransformation` sits beside `METABOLITE_OF`.** The graph edge remains. The transformation row records enzyme and product flags only where the existing seed already said so.
- **`parentCompoundId` and `CompoundRelationship` both exist.** The foreign key is the single primary parent (DDE of DDT, ETU of mancozeb). The relationship table is the typed graph, including replacements and isomers.

Score changes write `AssessmentRevision`. Re-seeding an unchanged row does not invent a new revision. A changed seed value does.

## Scoring

Signed effect, stored as an integer:

| Score | Meaning |
| --- | --- |
| −4 | Strongly protective or restorative |
| −3 | Substantially protective |
| −2 | Moderately protective |
| −1 | Weakly protective |
| 0 | No demonstrated meaningful effect |
| +1 | Weak disruptive signal |
| +2 | Plausible or moderate disruption |
| +3 | Substantial disruption |
| +4 | Strong or established disruption |

Blank means no quantitative score. “Phys.” means high physiological activity.

Human relevance, stored separately:

| Code | Meaning |
| --- | --- |
| H0 | No meaningful human evidence |
| H1 | Mechanistic, cellular, or high-dose animal |
| H2 | Strong experimental evidence, limited human evidence |
| H3 | Substantial human observation plus biological support |
| H4 | Established at clinically or environmentally relevant human exposure |

The headline for a domain is the strongest independent cluster, not a sum.

1. Child mechanisms that share an `aggregationGroup` contribute one score: the largest absolute effect.
2. Across groups, the domain cell is that largest cluster, not the sum of clusters.
3. Equal magnitudes prefer higher human relevance, then higher confidence. Human relevance is never multiplied into the effect.
4. Opposing directions are not averaged to zero. The larger magnitude stays. Displayed confidence drops one step, and the trace keeps both sides.
5. Research-only mechanisms are excluded.
6. A pathway that appears in more than one domain is described and not collapsed. A new tissue row in the same aggregation group is capped. It does not raise the domain headline by addition.

The same rules are on `/methodology`, and each compound page shows the trace.

Phase-1 numbers are seed hypotheses. Where a range was discussed, the stored integer is the end closer to zero. Curated findings have not been loaded yet, except one structural source that exists only to show that one document can support two findings. That source is marked as not scientific evidence.

## Local development

Postgres is the runtime database. The seed files under `src/data/seeds/` are the reconstructable starting set.

```bash
createdb edctox
cp .env.example .env
cp .env.example .env.local
# Put the same DATABASE_URL and DIRECT_URL in both files.
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Prisma CLI reads `.env`. Next.js reads `.env.local`. Keep them in sync locally.

```bash
npm run test:scoring
npm run typecheck
```

`/admin` is available in development only. It does not edit records.

## Supabase and Vercel

On a Supabase project:

1. Create a Postgres database.
2. Set `DATABASE_URL` to the pooled connection (port 6543) with `pgbouncer=true&sslmode=require`.
3. Set `DIRECT_URL` to the direct connection (port 5432) with `sslmode=require`. Migrations use `DIRECT_URL`. The app uses `DATABASE_URL`.
4. Do not put the service role key in any `NEXT_PUBLIC_` variable. This app does not need it. The browser only talks to the Next.js server.

On the Vercel project:

1. Import this repository.
2. Connect the database. Prisma Postgres supplies `DATABASE_URL` and does not create `DIRECT_URL`. The Vercel build uses `DATABASE_URL` for migrations when `DIRECT_URL` is absent.
3. A pooled host such as Supabase still needs both: `DATABASE_URL` on the pooler, and `DIRECT_URL` on the direct connection. Migrations cannot run through the pooler.
4. The build command in `vercel.json` is `npm run vercel-build`, which runs `prisma migrate deploy` and then `next build`.
5. `postinstall` runs `prisma generate`.
6. The build does not seed. Run `npm run db:seed` once against the hosted database.

Identity checks for BPA, DEHP, and PFOS are a separate command. A dry run calls PubChem and writes nothing:

```bash
npm run external:resolve -- --compound bpa,dehp,pfos --dry-run
```

`--apply` writes verified identifiers only. There is no `--all`. CompTox is skipped unless `EPA_CTX_API_KEY` is set on the server. Do not put that key in a `NEXT_PUBLIC_` variable. Pages do not call either provider.

Literature search is also a command, not a page render. Phase 3A searches BPA in the reproductive domain only. PubMed is the main discovery source: 15 records by relevance and 10 by publication date, for each purpose. Europe PMC searches title and abstract fields, uses the same two windows with 10 records each, and can add at most 10 unique candidates per purpose. A paper is kept only when the title or abstract contains Bisphenol A, or the BPA acronym together with that name or CAS 80-05-7, and a reproductive term. `HUMAN_REPRODUCTIVE` means human-relevant candidates, not confirmed human studies. The contradictory search is a separate, noisy supplement and does not establish a null finding. A dry run writes nothing. `--apply` writes candidate `EvidenceSource` rows and a `LiteratureSearchRun`. It does not write findings, and it does not change mechanism or outcome assessments. A later Europe PMC hit for the same paper can fill an empty PMCID or open-access flag. Imported papers stay non-evidence, at `SCREENING_PENDING`, unless the provider marks them retracted. Abstracts returned by those APIs are stored for screening and are not rendered on the public site.

```bash
npm run literature:search -- --compound bpa --domain reproductive --all-purposes --dry-run
```

`NCBI_API_KEY` and `NCBI_EMAIL` are optional. There is no `--all` compounds. The build does not run this command, so the site still renders if PubMed is down.

Machine screening is a separate local command. It writes a suggestion for a publication, compound, and domain. It does not set the curator decision.

```bash
npm run literature:screen -- --compound bpa --domain reproductive --pending --limit 20 --dry-run
```

The command refuses a database that is not localhost. `/admin/literature` is development-only and reads stored rows. It does not call PubMed or Europe PMC.

Abstract claim extraction is a separate local command for five BPA reproductive papers. It writes machine claims only. It does not write findings, and it does not change mechanism or outcome assessments. A claim is not scientific acceptance. The unlisted review list at `/admin/literature/claims` reads those stored claims. It does not show the full abstract. The screening desk stays off the public site.

```bash
npm run literature:claims -- --compound bpa --domain reproductive --limit 5 --dry-run
```

## External evidence architecture

EDCtox is a synthesis layer. It is not a replacement for EPA CompTox, ToxCast, ToxRefDB, ToxValDB, EDSP models, EU EASIS, ECHA CHEM, EFSA OpenFoodTox, NIEHS CEBS, OECD eChemPortal, OECD Harmonised Templates / IUCLID, AOP-Wiki, AICIS, APVMA PubCRIS, or PubChem.

Provider rows in `ExternalDataset` record where later imports will come from. They are metadata. This phase does not download or call those systems. `ExternalRecord` can hold a source payload before anyone normalises it. `rawData` is a cache. Findings, assay observations, regulatory rows, and assessments stay in their own tables.

An import must not change a curated mechanism score. A ToxCast hit is assay bioactivity, stored on `AssayObservation`, and it has no effect score. An ECHA endocrine-disruptor conclusion and an EFSA reference dose belong on `RegulatoryAssessment`, with a conclusion kind so an inventory listing cannot be stored as a hazard value. AICIS listing means the chemical is on the Australian industrial inventory. It is not a safety assessment. APVMA actives and formulated products stay separate compound records.

OECD templates contribute study metadata that the finding does not already have: guideline, GLP, Klimisch reliability, study purpose, strain, assay system, and comparator. Klimisch codes are not copied into study quality. Study quality is not assessment confidence.

AOP-Wiki terms can be mapped from a mechanism, outcome, or causal pathway. The mapping is a crosswalk. It does not replace `CausalPathway`, and it does not mean every mapped chemical causes the adverse outcome.

Identity precedence, when a later import proposes a match:

1. Exact structure or InChIKey, where a single structure is meaningful.
2. DTXSID or another DSSTox curated identity.
3. PubChem CID, checked against structure.
4. EC number or ECHA substance identity.
5. CAS Registry Number, as a useful and non-exclusive identifier.
6. Name matching only as a manual review.

Mixtures, formulations, UVCBs, polymers, salts, and stereochemical variants stay on manual review. Two compound rows are not merged because a name matches. A conflicting identifier is stored as a disputed row. It does not overwrite the existing value. DOI and PMID stay on the evidence source. AOP ids stay on the ontology mapping. They are not compound keys.

The convenience `casNumber` and `pubChemCid` columns remain. They are not promoted into `ExternalIdentifier` in this seed, because those values were not re-checked against DSSTox. InChI, InChIKey, and SMILES columns exist and are empty until a verified source supplies them.

EPA ToxPi is a precedent for showing several toxicological domains at once. A later ToxPi-like picture would keep those domains, and any weights would be explicit and chosen by the reader. A priority rank of that kind would not be a clinical or population risk. This phase does not draw one.

Gut, microbiome, and endothelial mechanisms are families inside the existing domains, plus a vascular domain that is stored and is not a profile column. Diversity, composition, and generic dysbiosis stay descriptive unless a later assessment explicitly supports a functional or adverse score. No compound is attached to these mechanisms in this seed. Aggregation groups, not the two new pathway definitions, are what stop a chain from being added into a headline.

## What phase 1 does not do

- It does not load a literature corpus. Later findings should be entered in Postgres, not by rewriting the seed files.
- It does not copy BPA’s scores onto BPS, or DEHP’s scores onto DINCH.
- It does not treat a regulatory classification as scientific consensus. The regulatory table is empty until real assessments are entered.
- It does not provide an editing UI. Score changes are meant to go through `AssessmentRevision` once curation exists.
- It does not download CompTox, ToxCast, ECHA, EFSA, AICIS, APVMA, or PubChem. The provider registry is metadata only.
