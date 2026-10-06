import { externalDatasets, IDENTITY_PRECEDENCE } from "~/data/seeds/externalDatasets";
import { SCORING_RULES } from "~/server/scoring/summarize";

export default function MethodologyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold tracking-tight">Scoring methodology</h1>
      <p className="mt-3 text-sm leading-6 text-stone-700">
        The unit of record is a compound, in an exposure context, at a mechanism or outcome, supported by a finding. Domain columns are summaries of those records. They are not a substitute for them, and they are not added into one toxicity number.
      </p>
      <ol className="mt-4 list-decimal space-y-3 pl-5 text-sm leading-6">
        {SCORING_RULES.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <h2 className="mt-8 text-lg font-medium">What a cell is showing</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        −4 is strongly protective or restorative. +4 is strong disruption. Zero would mean no meaningful effect was demonstrated. A blank cell means no quantitative score is stored. “Phys.” means high physiological activity, such as melatonin at its own receptors, and is not a disruption score. Confidence and human relevance sit beside the number because potency is not human risk.
      </p>
      <h2 className="mt-8 text-lg font-medium">Biological activity and consequence</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        A compound can strongly affect a pathway without that activity being harmful. Melatonin at MT1 and MT2 is high physiological activity with no signed effect score. Activity magnitude records the movement. The signed score records a protective or disruptive consequence, and it stays empty when that consequence is not justified.
      </p>
      <h2 className="mt-8 text-lg font-medium">Study quality and confidence</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        Study quality, exposure assessment, confounding, and outcome measurement are properties of a finding. Evidence confidence is the judgment on the assessment those findings support. A finding can remain not assessed while the seed assessment still carries a confidence. They are not copied onto each other.
      </p>
      <h2 className="mt-8 text-lg font-medium">Biological context and dose</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        The same mechanism can differ by organ, tissue, cell type, and subcellular compartment. Those contexts are shared lookups. A prescribed dose, an administered experimental dose, a dietary concentration, and an environmental concentration are different metrics. They are not converted into one number. Human relevance stays independent of the effect score.
      </p>
      <h2 className="mt-8 text-lg font-medium">Gut and microbiome evidence</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        A shift in alpha diversity, beta diversity, taxonomic composition, or a Firmicutes:Bacteroidetes ratio is a description of the community. It is not a signed toxicity score. The ratio is a measurement, not a mechanism. Generic dysbiosis stays descriptive unless an assessment explicitly supports a functional or adverse consequence. Barrier permeability, LPS translocation, short-chain fatty acids, bile-acid signalling, FXR and TGR5, enteroendocrine signalling, and microbial bioactivation can carry a signed score when the evidence supports that function. Sequencing method, sample site, diet, antibiotics, probiotics, batch effects, and population change what a microbiome result means. They are method context, not a quality grade. Host–microbe xenobiotic mechanisms sit on the exposure domain because they change effective exposure or bioavailability. They do not add a profile column.
      </p>
      <h2 className="mt-8 text-lg font-medium">Endothelial and vascular evidence</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        ICAM-1, VCAM-1, eNOS, and endothelial reactive oxygen species are mechanisms. They are not a diagnosis of cardiovascular disease. Nitric oxide bioavailability, vascular tone, the endothelial barrier, angiogenesis, haemostasis, and microvascular function live on a vascular domain that is stored and is not one of the seven profile columns. Adhesion and vascular inflammation remain immune mechanisms, each in its own aggregation group. Endothelial reactive oxygen species remains a redox mechanism in its own group. An outcome such as endothelial dysfunction or a thrombotic event stays separate from the mechanism that might lead to it.
      </p>
      <h2 className="mt-8 text-lg font-medium">Aggregation groups and pathways</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        Mechanisms that share an aggregation group are one cluster. The domain headline uses the strongest cluster. It does not add the members. Two empty pathway definitions name a gut-barrier chain and a bile-acid / FXR / TGR5 chain. No compound is attached to either. Pathway membership records the relationship. Aggregation groups, not pathway membership alone, are what currently stop those steps from inflating a score.
      </p>
      <h2 className="mt-8 text-lg font-medium">External evidence</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        EDCtox is a synthesis layer. CompTox, ToxCast, ToxRefDB, ToxValDB, EDSP models, EASIS, ECHA, OpenFoodTox, CEBS, eChemPortal, IUCLID, AOP-Wiki, AICIS, APVMA PubCRIS, and PubChem stay external. A verified PubChem or CompTox identifier is a link to that source. The compound page reads identifiers already stored and does not call those services while it renders. An imported record does not change a domain score. A ToxCast hit is assay bioactivity. An AICIS inventory listing is industrial availability, not safety. An AOP mapping is a crosswalk, not evidence that every linked chemical causes the adverse outcome. ToxPi is a useful precedent for a multidomain picture. EDCtox does not collapse that picture into one weighted total.
      </p>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-stone-700">
        {IDENTITY_PRECEDENCE.map((rule) => (
          <li key={rule}>{rule}</li>
        ))}
      </ol>
      <ul className="mt-3 space-y-2 text-sm leading-6 text-stone-700">
        {externalDatasets.map((dataset) => (
          <li key={dataset.code}>
            <span className="font-medium">{dataset.name}.</span> {dataset.description}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 text-lg font-medium">Mechanisms, claims, and assessments</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        A mechanism is a reusable concept in the ontology. A claim is a statement read from one paper. An assessment is the EDCtox judgment, including any signed score. The mechanism browser lists every mechanism, including those with no claims and no assessment. A compound page lists which of that compound’s claims are mapped, still candidate mappings, or unmapped. A machine-extracted claim can name a mechanism before a curator verifies the mapping. Those pages show the citation, directness, and mapping status. The supporting sentence stays unlisted. The number of claims does not change a score.
      </p>
      <h2 className="mt-8 text-lg font-medium">Literature candidates</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        A literature search can store a candidate publication for later screening. That row is not a finding, and it does not change a mechanism or outcome score. A later include or exclude decision is about one compound and one domain. It does not change the publication’s bibliographic status and it does not create a finding. A mechanistic claim read from an abstract is also not a finding. It does not change a score, and a review-priority label is not scientific acceptance. A human-relevant search is not confirmation that the study was a human clinical or observational study. A search for phrases such as “no association” is not confirmation of a null finding. An abstract returned by PubMed or Europe PMC may be kept for internal screening. Public pages do not show that abstract. A retracted publication can remain in the search record, and it still does not support a score.
      </p>
      <h2 className="mt-8 text-lg font-medium">Language</h2>
      <p className="mt-2 text-sm leading-6 text-stone-700">
        In vitro results stay in vitro. Animal results stay animal. Observational human results are associations. A receptor assay is not a disease. Therapeutic dose is not an overdose. A parent compound is not its formulation. Intended pharmacology is not automatically an adverse effect. Contradictory findings stay visible. Regulatory text, when it is added, is a separate layer.
      </p>
    </main>
  );
}
