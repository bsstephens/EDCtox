const SEED =
  "Phase-1 seed hypothesis, not a curated systematic review. Where a range was discussed, the stored integer is the conservative end closer to zero. A score is biological direction and magnitude, not human risk.";

type Direction =
  | "PROTECTIVE"
  | "DISRUPTIVE"
  | "PHYSIOLOGICAL"
  | "BIPHASIC"
  | "CONTEXT_DEPENDENT"
  | "MIXED"
  | "UNKNOWN";

type Confidence = "VERY_LOW" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";
type Human = "H0" | "H1" | "H2" | "H3" | "H4";
type Magnitude = "NONE" | "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" | "UNKNOWN";

export type MechanismAssessmentSeed = {
  compoundSlug: string;
  mechanismCode: string;
  assessmentKey: string;
  exposureContextKey?: string;
  biologicalContextKey?: string;
  pathwayCode?: string;
  effectScore: number | null;
  effectDirection: Direction;
  activityMagnitude: Magnitude;
  evidenceConfidence: Confidence;
  humanRelevance: Human;
  developmentalSensitivity: "NONE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL" | "UNKNOWN";
  conflictingEvidence: boolean;
  insufficientHumanEvidence: boolean;
  doseRelevanceUncertain: boolean;
  developmentalRelevanceUncertain: boolean;
  quantitativeScoreSupported: boolean;
  effectSummary: string;
  mechanismSummary: string;
  limitations: string;
};

export type OutcomeAssessmentSeed = {
  compoundSlug: string;
  outcomeCode: string;
  assessmentKey: string;
  exposureContextKey?: string;
  effectScore: number | null;
  effectDirection: Direction;
  activityMagnitude: Magnitude;
  evidenceConfidence: Confidence;
  humanRelevance: Human;
  lifeStage?:
    | "FETUS"
    | "CHILDHOOD"
    | "PUBERTY"
    | "ADULT"
    | "PREGNANCY";
  effectSummary: string;
  limitations: string;
  insufficientHumanEvidence?: boolean;
  doseRelevanceUncertain?: boolean;
  developmentalRelevanceUncertain?: boolean;
};

function magnitudeFor(score: number | null, direction: Direction, explicit?: Magnitude): Magnitude {
  if (explicit) return explicit;
  if (direction === "PHYSIOLOGICAL") return "VERY_HIGH";
  if (score === null) return "UNKNOWN";
  const abs = Math.abs(score);
  if (abs === 0) return "NONE";
  if (abs === 1) return "LOW";
  if (abs === 2) return "MODERATE";
  if (abs === 3) return "HIGH";
  return "VERY_HIGH";
}

function mechanism(
  input: Omit<
    MechanismAssessmentSeed,
    | "assessmentKey"
    | "activityMagnitude"
    | "developmentalSensitivity"
    | "conflictingEvidence"
    | "insufficientHumanEvidence"
    | "doseRelevanceUncertain"
    | "developmentalRelevanceUncertain"
    | "quantitativeScoreSupported"
    | "limitations"
  > &
    Partial<MechanismAssessmentSeed>,
): MechanismAssessmentSeed {
  const effectScore = input.effectScore;
  return {
    ...input,
    assessmentKey: input.assessmentKey ?? "default",
    activityMagnitude: magnitudeFor(effectScore, input.effectDirection, input.activityMagnitude),
    developmentalSensitivity: input.developmentalSensitivity ?? "UNKNOWN",
    conflictingEvidence: input.conflictingEvidence ?? false,
    insufficientHumanEvidence: input.insufficientHumanEvidence ?? false,
    doseRelevanceUncertain: input.doseRelevanceUncertain ?? false,
    developmentalRelevanceUncertain: input.developmentalRelevanceUncertain ?? false,
    quantitativeScoreSupported: input.quantitativeScoreSupported ?? effectScore !== null,
    limitations: input.limitations ?? SEED,
    effectScore,
  };
}

export const pathways = [
  {
    code: "BPA_INSULIN_SIGNALING",
    name: "BPA insulin-signalling cluster",
    description:
      "Insulin resistance, IRS1, and AKT are treated as one metabolic cluster for BPA. They are not three additive toxicity points.",
  },
  {
    code: "OLANZAPINE_METABOLIC_CHAIN",
    name: "Olanzapine metabolic, mitochondrial, and redox chain",
    description:
      "Therapeutic-dose insulin resistance may sit on a chain with experimental mitochondrial and redox findings. The domains stay separate and are not summed.",
  },
  {
    code: "PARAQUAT_REDOX_CYCLE",
    name: "Paraquat redox cycling",
    description:
      "Mitochondrial electron leak and ROS generation are one redox-cycling chain. The mitochondrial and redox headlines are not added.",
  },
  {
    code: "TFA_THYROID_DEVELOPMENT",
    name: "TFA thyroid developmental chain",
    description:
      "Thyroid hormone signalling and thyroid-dependent brain development are related. TFA is not labelled as a classical estrogen.",
  },
  {
    code: "GUT_BARRIER_METABOLIC_CHAIN",
    name: "Gut barrier, translocation, and metabolic chain",
    description:
      "Permeability, LPS translocation, inflammatory signalling, and insulin resistance can sit on one chain. No compound is attached. Aggregation groups, not pathway membership alone, stop those steps from being added inside a domain. The pathway only records the relationship.",
  },
  {
    code: "BILE_ACID_FXR_METABOLIC",
    name: "Bile-acid, FXR/TGR5, and metabolic chain",
    description:
      "Secondary bile acids, FXR, and TGR5 already share one aggregation group, so they are one metabolic cluster. This pathway names that chain and its possible metabolic continuation. No compound is attached. Pathway membership alone does not prevent score inflation.",
  },
] as const;

export const mechanismAssessments: MechanismAssessmentSeed[] = [
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "ER_ALPHA_AGONISM",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    developmentalSensitivity: "HIGH",
    effectSummary: "Estrogen-receptor-alpha activity is a substantial disruptive signal in this seed.",
    mechanismSummary: "Domain headline for reproductive endocrinology. Other estrogen-receptor children are the same cluster and are not scored again.",
  }),
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "BRAIN_SEXUAL_DIFFERENTIATION",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    developmentalSensitivity: "HIGH",
    effectSummary: "Developmental seed hypothesis at the conservative established-concern end of the discussed range.",
    mechanismSummary: "Attached to brain sexual differentiation rather than inferred to be only an adult receptor effect.",
  }),
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "CYTOKINE_SIGNALING",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    insufficientHumanEvidence: true,
    effectSummary: "Immune activation and cytokine signalling are seeded as one inflammatory cluster.",
    mechanismSummary: "TNF, IL-6, NF-κB, and immune activation share this cluster and are not additional points.",
  }),
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "INSULIN_RESISTANCE",
    pathwayCode: "BPA_INSULIN_SIGNALING",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    effectSummary: "Metabolic seed hypothesis. This is not a claim that BPA exposure is established to cause diabetes.",
    mechanismSummary: "Headline of the insulin-signalling cluster.",
  }),
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "IRS1",
    pathwayCode: "BPA_INSULIN_SIGNALING",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Downstream insulin-signalling node. Same cluster as insulin resistance.",
    mechanismSummary: "Capped into the insulin-signalling group so it cannot raise the domain total.",
  }),
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "AKT",
    pathwayCode: "BPA_INSULIN_SIGNALING",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Downstream insulin-signalling node. Same cluster as insulin resistance.",
    mechanismSummary: "Capped into the insulin-signalling group.",
  }),
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "ATP_PRODUCTION",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Mitochondrial seed at +3. Not inferred to be a reorganization-energy effect.",
    mechanismSummary: "Bioenergetic-output cluster only.",
  }),
  mechanism({
    compoundSlug: "bpa",
    mechanismCode: "ROS_TOTAL",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Redox seed at +3.",
    mechanismSummary: "ROS generation cluster. Lipid peroxidation is not scored again.",
  }),

  mechanism({
    compoundSlug: "dehp",
    mechanismCode: "TESTOSTERONE",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    developmentalSensitivity: "CRITICAL",
    effectSummary: "Disruption is reduced testicular testosterone synthesis, not an increase in testosterone.",
    mechanismSummary: "Steroidogenesis cluster. Enzyme rows are not added on top of the hormone-level row.",
  }),
  mechanism({
    compoundSlug: "dehp",
    mechanismCode: "ANOGENITAL_DISTANCE",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    developmentalSensitivity: "CRITICAL",
    effectSummary: "Shorter anogenital distance is the developmental morphological signal in this seed.",
    mechanismSummary: "Distinct from the adult steroidogenesis cluster.",
  }),
  mechanism({
    compoundSlug: "dehp",
    mechanismCode: "INSULIN_RESISTANCE",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    insufficientHumanEvidence: true,
    effectSummary: "Metabolic seed uses +3, the lower end of the discussed +3 to +4 range.",
    mechanismSummary: "Not added to the reproductive score.",
  }),
  mechanism({
    compoundSlug: "dehp",
    mechanismCode: "ATP_PRODUCTION",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Mitochondrial seed at +3.",
    mechanismSummary: "Not a reorganization-energy claim.",
  }),
  mechanism({
    compoundSlug: "dehp",
    mechanismCode: "ROS_TOTAL",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Redox seed at +3.",
    mechanismSummary: "ROS cluster only.",
  }),

  mechanism({
    compoundSlug: "pfos",
    mechanismCode: "FERTILITY",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    insufficientHumanEvidence: true,
    effectSummary: "Reproductive domain seed at +3, the lower end of +3 to +4. This is not an estrogen-receptor assignment.",
    mechanismSummary: "Placed on fertility because a single receptor mechanism is not established in this seed.",
  }),
  mechanism({
    compoundSlug: "pfos",
    mechanismCode: "NEURODEVELOPMENT",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H3",
    developmentalSensitivity: "HIGH",
    effectSummary: "Developmental seed hypothesis. Not a claim of a single completed causal pathway in humans.",
    mechanismSummary: "Neurodevelopment node, separate from thyroid-specific compounds such as TFA.",
  }),
  mechanism({
    compoundSlug: "pfos",
    mechanismCode: "ANTIBODY_RESPONSE",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    effectSummary: "Reduced antibody response, including vaccine-response literature, is the immune seed. Association is not restated as proven causation for every exposure.",
    mechanismSummary: "Antibody and vaccine response share one cluster.",
  }),
  mechanism({
    compoundSlug: "pfos",
    mechanismCode: "PPAR_ALPHA",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H2",
    effectSummary: "PPAR-alpha activity is a biological effect with metabolic concern. It is not itself a diagnosis of diabetes.",
    mechanismSummary: "Nuclear-receptor lipid cluster.",
  }),
  mechanism({
    compoundSlug: "pfos",
    mechanismCode: "ATP_PRODUCTION",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Mitochondrial seed at +3.",
    mechanismSummary: "Bioenergetic output only.",
  }),
  mechanism({
    compoundSlug: "pfos",
    mechanismCode: "ROS_TOTAL",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Redox seed at +3.",
    mechanismSummary: "ROS cluster only.",
  }),

  mechanism({
    compoundSlug: "olanzapine",
    mechanismCode: "PROLACTIN",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    effectSummary: "Prolactin elevation occurs but is seeded below risperidone.",
    mechanismSummary: "HPG-axis cluster. GnRH is not scored again.",
  }),
  mechanism({
    compoundSlug: "olanzapine",
    mechanismCode: "DEVELOPMENTAL_METABOLIC_PROGRAMMING",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    developmentalRelevanceUncertain: true,
    effectSummary: "Developmental seed at +2. Pregnancy and childhood evidence is not established here.",
    mechanismSummary: "Not the adult metabolic score.",
  }),
  mechanism({
    compoundSlug: "olanzapine",
    mechanismCode: "DOPAMINE",
    effectScore: 3,
    effectDirection: "CONTEXT_DEPENDENT",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    effectSummary: "D2 antagonism is intended antipsychotic pharmacology. The signed score is not a claim that dopamine blockade is solely an adverse endocrine effect.",
    mechanismSummary: "Kept separate from prolactin and from insulin resistance.",
  }),
  mechanism({
    compoundSlug: "olanzapine",
    mechanismCode: "INSULIN_RESISTANCE",
    pathwayCode: "OLANZAPINE_METABOLIC_CHAIN",
    exposureContextKey: "therapeutic-adult",
    assessmentKey: "therapeutic-adult",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    effectSummary: "Substantial insulin resistance is recorded at therapeutic adult use. This is a clinical association, not a claim that every exposed person develops diabetes.",
    mechanismSummary: "Headline metabolic cluster at therapeutic dose.",
  }),
  mechanism({
    compoundSlug: "olanzapine",
    mechanismCode: "IRS1",
    pathwayCode: "OLANZAPINE_METABOLIC_CHAIN",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Signalling node in the same insulin cluster. Not an extra metabolic point.",
    mechanismSummary: "Capped with insulin resistance.",
  }),
  mechanism({
    compoundSlug: "olanzapine",
    mechanismCode: "ATP_PRODUCTION",
    pathwayCode: "OLANZAPINE_METABOLIC_CHAIN",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Mitochondrial seed at +3. Human therapeutic-dose relevance is not established.",
    mechanismSummary: "Tagged on the same pathway as insulin resistance so the profile can show the chain without summing it.",
  }),
  mechanism({
    compoundSlug: "olanzapine",
    mechanismCode: "ROS_TOTAL",
    pathwayCode: "OLANZAPINE_METABOLIC_CHAIN",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Redox seed at +3 under experimental and mechanistic discussion.",
    mechanismSummary: "Same pathway tag as the metabolic and mitochondrial rows. Not added to them.",
  }),

  mechanism({
    compoundSlug: "risperidone",
    mechanismCode: "PROLACTIN",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    effectSummary: "Hyperprolactinemia is an established pharmacological effect at therapeutic doses.",
    mechanismSummary: "HPG-axis headline. This is not the metabolic comparison with olanzapine.",
  }),
  mechanism({
    compoundSlug: "risperidone",
    mechanismCode: "GNRH",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    effectSummary: "GnRH suppression is downstream of prolactin in this seed and shares the HPG cluster.",
    mechanismSummary: "Capped with prolactin. It does not raise REP from +4 to +7.",
  }),
  mechanism({
    compoundSlug: "risperidone",
    mechanismCode: "PUBERTY_TIMING",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    developmentalSensitivity: "HIGH",
    developmentalRelevanceUncertain: true,
    effectSummary: "Developmental seed at +3, mainly through prolactin and pubertal axis concern.",
    mechanismSummary: "Not a metabolic score.",
  }),
  mechanism({
    compoundSlug: "risperidone",
    mechanismCode: "DOPAMINE",
    effectScore: 4,
    effectDirection: "CONTEXT_DEPENDENT",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    effectSummary: "Potent D2 antagonism is intended pharmacology and the driver of the prolactin effect.",
    mechanismSummary: "Neuroendocrine headline. Separate from insulin resistance.",
  }),
  mechanism({
    compoundSlug: "risperidone",
    mechanismCode: "INSULIN_RESISTANCE",
    exposureContextKey: "therapeutic-adult",
    assessmentKey: "therapeutic-adult",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    effectSummary: "Metabolic disruption is seeded at +3, below olanzapine's +4.",
    mechanismSummary: "Therapeutic-dose context. Not summed with prolactin.",
  }),

  mechanism({
    compoundSlug: "valproate",
    mechanismCode: "TESTOSTERONE",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    effectSummary: "Reproductive endocrine disruption, including androgen and ovulatory associations, is seeded at +4. Direction of each hormone is not uniform and is not reduced to one receptor.",
    mechanismSummary: "Domain headline. PCOS is an outcome row, not this mechanism.",
  }),
  mechanism({
    compoundSlug: "valproate",
    mechanismCode: "NEURODEVELOPMENT",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    developmentalSensitivity: "CRITICAL",
    effectSummary: "Developmental toxicity including neural-tube defects is established. Much of it is not specifically endocrine.",
    mechanismSummary: "Scored on neurodevelopment so a non-endocrine teratogenic effect is not mislabelled as estrogenic.",
  }),
  mechanism({
    compoundSlug: "valproate",
    mechanismCode: "INSULIN_RESISTANCE",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    effectSummary: "Weight gain and insulin-resistance associations during therapeutic use.",
    mechanismSummary: "Metabolic cluster, separate from teratogenicity.",
  }),
  mechanism({
    compoundSlug: "valproate",
    mechanismCode: "ATP_PRODUCTION",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Mitochondrial seed at +3.",
    mechanismSummary: "Not inferred from the teratogenic outcome alone.",
  }),
  mechanism({
    compoundSlug: "valproate",
    mechanismCode: "ROS_TOTAL",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Redox seed at +3.",
    mechanismSummary: "ROS cluster only.",
  }),

  mechanism({
    compoundSlug: "fluoxetine",
    mechanismCode: "ER_ALPHA_AGONISM",
    effectScore: 3,
    effectDirection: "CONTEXT_DEPENDENT",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    conflictingEvidence: true,
    insufficientHumanEvidence: true,
    effectSummary: "Reproductive seed at +3 with context-dependent estrogen-receptor and steroidogenic expression findings. The literature is not one direction.",
    mechanismSummary: "Conflicting flag is set. A receptor-expression result is not a human disease claim.",
  }),
  mechanism({
    compoundSlug: "fluoxetine",
    mechanismCode: "NEURODEVELOPMENT",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    developmentalSensitivity: "MODERATE",
    developmentalRelevanceUncertain: true,
    effectSummary: "Developmental seed at +2, the lower end of +2 to +3.",
    mechanismSummary: "Not the serotonergic pharmacology score.",
  }),
  mechanism({
    compoundSlug: "fluoxetine",
    mechanismCode: "SEROTONIN",
    effectScore: 3,
    effectDirection: "CONTEXT_DEPENDENT",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    effectSummary: "Serotonin-reuptake inhibition is intended pharmacology. The score marks strong biological activity, not an adverse-event rank.",
    mechanismSummary: "Separate from the context-dependent estrogen-receptor row.",
  }),
  mechanism({
    compoundSlug: "fluoxetine",
    mechanismCode: "INSULIN_RESISTANCE",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    effectSummary: "Metabolic seed at +2.",
    mechanismSummary: "Modest relative to olanzapine in this seed.",
  }),
  mechanism({
    compoundSlug: "fluoxetine",
    mechanismCode: "ATP_PRODUCTION",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Mitochondrial seed at +2.",
    mechanismSummary: "Experimental relevance to therapeutic dose is uncertain.",
  }),
  mechanism({
    compoundSlug: "fluoxetine",
    mechanismCode: "ROS_TOTAL",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Redox seed at +2, the lower end of +2 to +3.",
    mechanismSummary: "ROS cluster only.",
  }),

  mechanism({
    compoundSlug: "methylphenidate",
    mechanismCode: "FERTILITY",
    effectScore: 2,
    effectDirection: "UNKNOWN",
    evidenceConfidence: "VERY_LOW",
    humanRelevance: "H0",
    insufficientHumanEvidence: true,
    developmentalRelevanceUncertain: true,
    effectSummary: "Reproductive seed at +2 is explicitly uncertain. It is not an established fertility effect.",
    mechanismSummary: "Very low confidence. Absence of a stronger score is not evidence of safety or of harm.",
  }),
  mechanism({
    compoundSlug: "methylphenidate",
    mechanismCode: "GROWTH",
    exposureContextKey: "therapeutic-child",
    assessmentKey: "therapeutic-child",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    developmentalSensitivity: "HIGH",
    effectSummary: "Slower growth during therapeutic paediatric use is a clinical effect. The score is the lower end of +2 to +3. It is not a mitochondrial finding.",
    mechanismSummary: "Growth node at therapeutic childhood exposure.",
  }),
  mechanism({
    compoundSlug: "methylphenidate",
    mechanismCode: "APPETITE_HYPOTHALAMUS",
    exposureContextKey: "therapeutic-child",
    assessmentKey: "therapeutic-child",
    effectScore: 3,
    effectDirection: "CONTEXT_DEPENDENT",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    effectSummary: "Reduced appetite is an established clinical effect at therapeutic doses. It is pharmacology, not evidence of neuronal mitochondrial injury.",
    mechanismSummary: "Appetite cluster. Separate from complex I or ATP rows.",
  }),
  mechanism({
    compoundSlug: "methylphenidate",
    mechanismCode: "INSULIN_RESISTANCE",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Metabolic seed at +2. Not the appetite effect.",
    mechanismSummary: "Insulin-signalling cluster.",
  }),
  mechanism({
    compoundSlug: "methylphenidate",
    mechanismCode: "ATP_PRODUCTION",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Experimental mitochondrial seed at +2, the lower end of +2 to +3. Therapeutic-dose human relevance is uncertain.",
    mechanismSummary: "Must not be read as the established growth or appetite effect.",
  }),
  mechanism({
    compoundSlug: "methylphenidate",
    mechanismCode: "ROS_TOTAL",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Experimental redox seed at +2, the lower end of +2 to +3.",
    mechanismSummary: "Therapeutic-dose human relevance is uncertain.",
  }),

  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "FERTILITY",
    effectScore: 1,
    effectDirection: "UNKNOWN",
    evidenceConfidence: "VERY_LOW",
    humanRelevance: "H0",
    developmentalRelevanceUncertain: true,
    insufficientHumanEvidence: true,
    effectSummary: "Reproductive concern is seeded at +1 and is uncertain. It is not evidence of developmental toxicity, and it is not the MT1/MT2 physiological activity.",
    mechanismSummary: "Fertility node. Puberty timing is recorded separately on the developmental domain.",
  }),
  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "PUBERTY_TIMING",
    effectScore: 1,
    effectDirection: "UNKNOWN",
    evidenceConfidence: "VERY_LOW",
    humanRelevance: "H0",
    developmentalSensitivity: "UNKNOWN",
    developmentalRelevanceUncertain: true,
    insufficientHumanEvidence: true,
    effectSummary: "Developmental seed at +1. Long-term childhood puberty effects are not demonstrated.",
    mechanismSummary: "Kept separate from protective mitochondrial and redox experiments.",
  }),
  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "MELATONIN_MT1",
    effectScore: null,
    effectDirection: "PHYSIOLOGICAL",
    activityMagnitude: "VERY_HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    quantitativeScoreSupported: false,
    effectSummary: "Endogenous ligand activity at MT1 is high and physiological. No signed disruption score is assigned.",
    mechanismSummary: "Same receptor cluster as MT2, so the two receptors are not two toxicity points.",
  }),
  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "MELATONIN_MT2",
    effectScore: null,
    effectDirection: "PHYSIOLOGICAL",
    activityMagnitude: "VERY_HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    quantitativeScoreSupported: false,
    effectSummary: "Endogenous ligand activity at MT2 is high and physiological.",
    mechanismSummary: "Capped in the melatonin-receptor cluster with MT1.",
  }),
  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "IMMUNE_SUPPRESSION",
    effectScore: -2,
    effectDirection: "PROTECTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Experimental immunomodulation seeded at −2, the lower-magnitude end of −2 to −3. Not a clinical anti-inflammatory indication.",
    mechanismSummary: "Immune-suppression cluster. Direction is protective in the experimental seed, which is not the same as therapeutic efficacy.",
  }),
  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "INSULIN_RESISTANCE",
    effectScore: null,
    effectDirection: "CONTEXT_DEPENDENT",
    activityMagnitude: "LOW",
    evidenceConfidence: "VERY_LOW",
    humanRelevance: "H1",
    conflictingEvidence: true,
    quantitativeScoreSupported: false,
    effectSummary: "Metabolic endpoints were discussed around −1 to +1. The range crosses zero, so no signed score is stored.",
    mechanismSummary: "Context-dependent. A single integer would invent a direction.",
  }),
  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "ATP_PRODUCTION",
    assessmentKey: "toxicant-stress",
    exposureContextKey: "experimental-toxicant-stress",
    biologicalContextKey: "mitochondrion",
    effectScore: -3,
    effectDirection: "PROTECTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Protective mitochondrial seed at −3 under toxicant or oxidative stress, the lower-magnitude end of −3 to −4. Not a claim of clinical benefit.",
    mechanismSummary: "Experimental co-exposure context. Not the endogenous physiology row.",
  }),
  mechanism({
    compoundSlug: "melatonin",
    mechanismCode: "ROS_TOTAL",
    assessmentKey: "oxidative-injury",
    exposureContextKey: "experimental-toxicant-stress",
    biologicalContextKey: "dopaminergic-neuron",
    effectScore: -4,
    effectDirection: "PROTECTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Protective redox seed at −4 under oxidative injury in experimental models. Experimental protection is not demonstrated clinical benefit.",
    mechanismSummary: "ROS cluster in the toxicant-stress context.",
  }),

  mechanism({
    compoundSlug: "paraquat",
    mechanismCode: "ETC_COMPLEX_I",
    pathwayCode: "PARAQUAT_REDOX_CYCLE",
    biologicalContextKey: "mitochondrion",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "HIGH",
    humanRelevance: "H2",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Strong mitochondrial disruption in experimental and high-exposure settings. Human disease causation is not scored as established.",
    mechanismSummary: "Complex I / redox-cycle cluster. Not an ER or AR mechanism.",
  }),
  mechanism({
    compoundSlug: "paraquat",
    mechanismCode: "ROS_TOTAL",
    pathwayCode: "PARAQUAT_REDOX_CYCLE",
    biologicalContextKey: "dopaminergic-neuron",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "HIGH",
    humanRelevance: "H2",
    doseRelevanceUncertain: true,
    effectSummary: "Redox cycling with substantial ROS generation. Shown beside the mitochondrial score and not added to it.",
    mechanismSummary: "Same pathway tag as complex I.",
  }),
  mechanism({
    compoundSlug: "paraquat",
    mechanismCode: "IMMUNE_ACTIVATION",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Inflammatory and neuroinflammatory seed at +3.",
    mechanismSummary: "Cytokine cluster. Not a classical endocrine score.",
  }),
  mechanism({
    compoundSlug: "paraquat",
    mechanismCode: "ER_ALPHA_AGONISM",
    effectScore: null,
    effectDirection: "UNKNOWN",
    activityMagnitude: "NONE",
    evidenceConfidence: "LOW",
    humanRelevance: "H0",
    quantitativeScoreSupported: false,
    effectSummary: "No classical ER-alpha activity is scored. Lack of a number is not proof of absence.",
    mechanismSummary: "Present so the compound page does not look like an estrogenic profile.",
  }),
  mechanism({
    compoundSlug: "paraquat",
    mechanismCode: "ANDROGEN_RECEPTOR_AGONISM",
    effectScore: null,
    effectDirection: "UNKNOWN",
    activityMagnitude: "NONE",
    evidenceConfidence: "LOW",
    humanRelevance: "H0",
    quantitativeScoreSupported: false,
    effectSummary: "No classical androgen-receptor activity is scored.",
    mechanismSummary: "Unscored receptor note.",
  }),

  mechanism({
    compoundSlug: "rotenone",
    mechanismCode: "ETC_COMPLEX_I",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "HIGH",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
    effectSummary: "Complex I inhibition is the established experimental mechanism.",
    mechanismSummary: "Not complex II. Not an estrogen-receptor effect.",
  }),
  mechanism({
    compoundSlug: "rotenone",
    mechanismCode: "ROS_TOTAL",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "HIGH",
    humanRelevance: "H1",
    insufficientHumanEvidence: true,
    effectSummary: "Substantial ROS generation accompanies complex I blockade in experimental systems.",
    mechanismSummary: "Separate domain from complex I. Not summed.",
  }),

  ...(["boscalid", "bixafen", "fluxapyroxad", "fluopyram"] as const).map((compoundSlug) =>
    mechanism({
      compoundSlug,
      mechanismCode: "ETC_COMPLEX_II",
      effectScore: 4,
      effectDirection: "DISRUPTIVE",
      evidenceConfidence: "MODERATE",
      humanRelevance: "H1",
      insufficientHumanEvidence: true,
      doseRelevanceUncertain: true,
      effectSummary:
        compoundSlug === "boscalid"
          ? "Strong mechanistic complex II disruption. This is the fungicidal mode of action. Current human evidence at environmental exposure is weak."
          : "SDHI mode-of-action hypothesis at complex II. Compound-specific mammalian literature is not curated in this phase.",
      mechanismSummary: "Complex II cluster. Succinate and fumarate would be capped here. Reorganization energy is a different, unscored field.",
      limitations: `${SEED} Human relevance is H1. Do not read fungal target potency as clinical or environmental human risk.`,
    }),
  ),
  mechanism({
    compoundSlug: "boscalid",
    mechanismCode: "REORGANIZATION_ENERGY",
    effectScore: null,
    effectDirection: "UNKNOWN",
    activityMagnitude: "UNKNOWN",
    evidenceConfidence: "VERY_LOW",
    humanRelevance: "H0",
    quantitativeScoreSupported: false,
    effectSummary: "The field is open. No score is assigned, and none is inferred from complex II inhibition.",
    mechanismSummary: "Research-only policy. Excluded from the mitochondrial headline.",
    limitations: "Marcus reorganization energy requires direct evidence. ATP or respiration changes are not that evidence.",
  }),

  mechanism({
    compoundSlug: "tfa",
    mechanismCode: "THYROID_HORMONE",
    pathwayCode: "TFA_THYROID_DEVELOPMENT",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    insufficientHumanEvidence: true,
    effectSummary: "Thyroid-axis concern is the neuroendocrine seed. Human causality is below an established clinical or environmental H4.",
    mechanismSummary: "Thyroid hormone cluster. Not ER-alpha.",
  }),
  mechanism({
    compoundSlug: "tfa",
    mechanismCode: "THYROID_DEPENDENT_BRAIN_DEVELOPMENT",
    pathwayCode: "TFA_THYROID_DEVELOPMENT",
    effectScore: 3,
    effectDirection: "DISRUPTIVE",
    evidenceConfidence: "LOW",
    humanRelevance: "H2",
    developmentalSensitivity: "HIGH",
    insufficientHumanEvidence: true,
    developmentalRelevanceUncertain: true,
    effectSummary: "Developmental seed at +3 through thyroid-dependent brain development.",
    mechanismSummary: "Linked to the thyroid pathway and not added to the neuroendocrine score.",
  }),
  mechanism({
    compoundSlug: "tfa",
    mechanismCode: "ER_ALPHA_AGONISM",
    effectScore: null,
    effectDirection: "UNKNOWN",
    activityMagnitude: "NONE",
    evidenceConfidence: "LOW",
    humanRelevance: "H0",
    quantitativeScoreSupported: false,
    effectSummary: "TFA is not seeded as a classical estrogenic compound.",
    mechanismSummary: "Unscored on purpose so an empty estrogen cell is explicit.",
  }),
];

export const outcomeAssessments: OutcomeAssessmentSeed[] = [
  {
    compoundSlug: "olanzapine",
    outcomeCode: "INSULIN_RESISTANCE",
    assessmentKey: "therapeutic-adult",
    exposureContextKey: "therapeutic-adult",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    activityMagnitude: "VERY_HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    lifeStage: "ADULT",
    effectSummary: "Clinical association with insulin resistance during therapeutic use. This outcome is not inferred solely from the IRS1 mechanism row.",
    limitations: SEED,
  },
  {
    compoundSlug: "olanzapine",
    outcomeCode: "WEIGHT_GAIN",
    assessmentKey: "therapeutic-adult",
    exposureContextKey: "therapeutic-adult",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    activityMagnitude: "VERY_HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    lifeStage: "ADULT",
    effectSummary: "Weight gain is an established treatment-associated outcome. It is not the same measurement as a mitochondrial assay.",
    limitations: SEED,
  },
  {
    compoundSlug: "risperidone",
    outcomeCode: "HYPERPROLACTINEMIA",
    assessmentKey: "therapeutic-adult",
    exposureContextKey: "therapeutic-adult",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    activityMagnitude: "VERY_HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    lifeStage: "ADULT",
    effectSummary: "Hyperprolactinemia is an established pharmacological outcome. It is not an insulin-resistance outcome.",
    limitations: SEED,
  },
  {
    compoundSlug: "valproate",
    outcomeCode: "NEURODEVELOPMENTAL_CHANGE",
    assessmentKey: "pregnancy",
    exposureContextKey: "therapeutic-pregnancy",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    activityMagnitude: "VERY_HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    lifeStage: "PREGNANCY",
    effectSummary: "Neurodevelopmental and neural-tube harm after gestational exposure is established. Much of that harm is not specifically endocrine.",
    limitations: SEED,
  },
  {
    compoundSlug: "methylphenidate",
    outcomeCode: "REDUCED_APPETITE",
    assessmentKey: "therapeutic-child",
    exposureContextKey: "therapeutic-child",
    effectScore: 3,
    effectDirection: "CONTEXT_DEPENDENT",
    activityMagnitude: "HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H4",
    lifeStage: "CHILDHOOD",
    effectSummary: "Reduced appetite at therapeutic doses is a clinical effect. It does not demonstrate neuronal mitochondrial injury.",
    limitations: SEED,
  },
  {
    compoundSlug: "methylphenidate",
    outcomeCode: "REDUCED_LINEAR_GROWTH",
    assessmentKey: "therapeutic-child",
    exposureContextKey: "therapeutic-child",
    effectScore: 2,
    effectDirection: "DISRUPTIVE",
    activityMagnitude: "MODERATE",
    evidenceConfidence: "MODERATE",
    humanRelevance: "H3",
    lifeStage: "CHILDHOOD",
    effectSummary: "Slower height gain during treatment is recorded separately from experimental mitochondrial scores.",
    limitations: SEED,
  },
  {
    compoundSlug: "paraquat",
    outcomeCode: "MITOCHONDRIAL_DYSFUNCTION",
    assessmentKey: "experimental",
    effectScore: 4,
    effectDirection: "DISRUPTIVE",
    activityMagnitude: "VERY_HIGH",
    evidenceConfidence: "HIGH",
    humanRelevance: "H2",
    effectSummary: "Mitochondrial dysfunction is strongly supported experimentally. A human neurodegenerative diagnosis is not automatically assigned.",
    limitations: `${SEED} Dose relevance to ordinary environmental exposure is uncertain.`,
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
  },
  {
    compoundSlug: "boscalid",
    outcomeCode: "MITOCHONDRIAL_DYSFUNCTION",
    assessmentKey: "mechanistic",
    effectScore: null,
    effectDirection: "UNKNOWN",
    activityMagnitude: "UNKNOWN",
    evidenceConfidence: "VERY_LOW",
    humanRelevance: "H1",
    effectSummary: "Complex II inhibition is mechanistic. A clinical mitochondrial-disease outcome is not scored.",
    limitations: "Mode of action in fungi is not a human outcome.",
    insufficientHumanEvidence: true,
    doseRelevanceUncertain: true,
  },
];

export const exposureContexts = [
  ["bpa", "dietary-adult", "ORAL", "General population", "ADULT", "DIETARY", "ENVIRONMENTAL", false, false, "HIGH", "Dietary and food-contact context. Dose is not quantified in this seed."],
  ["bpa", "developmental-dietary", "ORAL", "Fetus via maternal diet", "FETUS", "DIETARY", "ENVIRONMENTAL", false, true, "MODERATE", "Gestational window is not further specified."],
  ["dehp", "dietary-general", "ORAL", "General population", "ADULT", "DIETARY", "ENVIRONMENTAL", false, false, "HIGH", "Diet, dust, and consumer products are grouped only as context, not as one dose."],
  ["dehp", "fetal", "ORAL", "Fetus via maternal exposure", "FETUS", "DIETARY", "ENVIRONMENTAL", false, true, "MODERATE", "Relevant to anogenital-distance hypotheses. Dose not curated."],
  ["pfos", "environmental-general", "ENVIRONMENTAL_MEDIA", "General population", "ADULT", "ENVIRONMENTAL", "ENVIRONMENTAL", false, false, "HIGH", "Legacy exposure. Serum levels are not entered in this seed."],
  ["olanzapine", "therapeutic-adult", "ORAL", "Adults prescribed olanzapine", "ADULT", "THERAPEUTIC", "THERAPEUTIC", false, false, "HIGH", "Therapeutic dose, not overdose."],
  ["risperidone", "therapeutic-adult", "ORAL", "Adults prescribed risperidone", "ADULT", "THERAPEUTIC", "THERAPEUTIC", false, false, "HIGH", "Therapeutic dose."],
  ["valproate", "therapeutic-adult", "ORAL", "Adults prescribed valproate", "ADULT", "THERAPEUTIC", "THERAPEUTIC", false, false, "HIGH", "Therapeutic dose."],
  ["valproate", "therapeutic-pregnancy", "ORAL", "Pregnant patients prescribed valproate", "PREGNANCY", "THERAPEUTIC", "THERAPEUTIC", false, true, "HIGH", "Gestational therapeutic exposure. The developmental outcome is not an overdose claim."],
  ["fluoxetine", "therapeutic-adult", "ORAL", "Adults prescribed fluoxetine", "ADULT", "THERAPEUTIC", "THERAPEUTIC", false, false, "HIGH", "Therapeutic dose. Intended serotonergic effect is distinguished from endocrine findings."],
  ["methylphenidate", "therapeutic-child", "ORAL", "Children prescribed methylphenidate", "CHILDHOOD", "THERAPEUTIC", "THERAPEUTIC", false, false, "HIGH", "Therapeutic paediatric dose. Mitochondrial rows must not be read as this context without better evidence."],
  ["melatonin", "therapeutic-adult", "ORAL", "Adults using exogenous melatonin", "ADULT", "THERAPEUTIC", "THERAPEUTIC", false, false, "MODERATE", "Exogenous sleep use. Not the same as endogenous nocturnal secretion."],
  ["melatonin", "childhood-exogenous", "ORAL", "Children using exogenous melatonin", "CHILDHOOD", "THERAPEUTIC", "THERAPEUTIC", false, false, "UNCERTAIN", "Long-term childhood use. Puberty effects are a data gap."],
  ["melatonin", "experimental-toxicant-stress", "UNSPECIFIED", "Experimental models under toxicant or oxidative stress", "ADULT", "EXPERIMENTAL", "NEITHER", false, false, "LOW", "Co-exposure or pretreatment models. Not a clinical regimen and not evidence of clinical benefit."],
  ["paraquat", "occupational", "MULTIPLE", "Occupationally exposed adults", "ADULT", "OCCUPATIONAL", "ENVIRONMENTAL", true, false, "MODERATE", "Occupational context. Ordinary dietary exposure is not implied."],
  ["paraquat", "experimental", "UNSPECIFIED", "Experimental high-exposure models", "ADULT", "EXPERIMENTAL", "NEITHER", false, false, "LOW", "Experimental doses used in mitochondrial and redox studies."],
  ["rotenone", "experimental", "UNSPECIFIED", "Experimental complex I models", "ADULT", "EXPERIMENTAL", "NEITHER", false, false, "LOW", "Laboratory model. Not a current dietary exposure estimate."],
  ["boscalid", "environmental-residue", "ORAL", "General population, dietary residues", "ADULT", "DIETARY", "ENVIRONMENTAL", false, false, "UNCERTAIN", "Residue context. Fungicidal target-site concentration is not a human internal dose."],
  ["tfa", "environmental-general", "ENVIRONMENTAL_MEDIA", "General population", "ADULT", "ENVIRONMENTAL", "ENVIRONMENTAL", false, false, "MODERATE", "Persistent environmental presence. Human causal dose is not established in this seed."],
  ["tfa", "developmental", "ENVIRONMENTAL_MEDIA", "Fetus and infant via environmental exposure", "FETUS", "ENVIRONMENTAL", "ENVIRONMENTAL", false, true, "UNCERTAIN", "Developmental window is not precisely defined."],
  ["chlorpyrifos", "dietary-child", "ORAL", "Children, dietary residues", "CHILDHOOD", "DIETARY", "ENVIRONMENTAL", false, false, "MODERATE", "Context only. No mechanistic score is seeded."],
  ["chlorpyrifos", "occupational", "DERMAL", "Occupationally exposed adults", "ADULT", "OCCUPATIONAL", "ENVIRONMENTAL", true, false, "MODERATE", "Context only. Formulations may include co-formulants."],
] as const;

export type ExposureSeed = {
  compoundSlug: string;
  contextKey: string;
  route: string;
  population: string;
  lifeStage: string;
  exposureType: string;
  therapeuticVsEnvironmental: string;
  occupational: boolean;
  maternalExposure: boolean;
  realWorldRelevance: string;
  notes: string;
  developmentalWindow?: string;
  doseMetricType: string;
};

function doseMetricFor(exposureType: string): string {
  if (exposureType === "THERAPEUTIC") return "PRESCRIBED_DOSE";
  if (exposureType === "EXPERIMENTAL") return "ADMINISTERED_DOSE";
  if (exposureType === "DIETARY") return "DIETARY_CONCENTRATION";
  if (exposureType === "ENVIRONMENTAL") return "ENVIRONMENTAL_CONCENTRATION";
  return "UNKNOWN";
}

export const exposureSeeds: ExposureSeed[] = exposureContexts.map((row) => ({
  compoundSlug: row[0],
  contextKey: row[1],
  route: row[2],
  population: row[3],
  lifeStage: row[4],
  exposureType: row[5],
  therapeuticVsEnvironmental: row[6],
  occupational: row[7],
  maternalExposure: row[8],
  realWorldRelevance: row[9],
  notes: row[10],
  developmentalWindow: row[4] === "FETUS" ? "Gestational window not further specified in this seed" : undefined,
  doseMetricType: doseMetricFor(row[5]),
}));

export const relationships = [
  ["dde", "ddt", "METABOLITE_OF", "p,p'-DDE is a persistent metabolite and breakdown product of DDT."],
  ["etu", "mancozeb", "BREAKDOWN_PRODUCT_OF", "Ethylenethiourea is a major breakdown product of mancozeb."],
  ["paliperidone", "risperidone", "METABOLITE_OF", "Paliperidone is 9-hydroxyrisperidone, the active metabolite of risperidone."],
  ["prednisolone", "prednisone", "METABOLITE_OF", "Prednisone is a prodrug. Prednisolone is the active glucocorticoid."],
  ["dexamphetamine", "lisdexamfetamine", "METABOLITE_OF", "Lisdexamfetamine is a prodrug of dextroamphetamine."],
  ["escitalopram", "citalopram", "ISOMER_OF", "Escitalopram is the S-enantiomer of citalopram."],
  ["bpaf", "bpa", "REPLACEMENT_FOR", "BPAF has been used as a fluorinated bisphenol analogue and replacement. It is not assumed to be safer."],
  ["bps", "bpa", "REPLACEMENT_FOR", "BPS has been used as a BPA replacement. Activity is not copied from BPA in this seed."],
  ["bpf", "bpa", "REPLACEMENT_FOR", "BPF has been used as a BPA replacement. Activity is not copied from BPA in this seed."],
  ["bpb", "bpa", "ANALOG_OF", "Structural analogue. Unscored."],
  ["bpz", "bpa", "ANALOG_OF", "Structural analogue. Unscored."],
  ["bpap", "bpa", "ANALOG_OF", "Structural analogue. Unscored."],
  ["dinch", "dehp", "REPLACEMENT_FOR", "Non-phthalate plasticiser used to replace DEHP. No score is transferred."],
  ["deht", "dehp", "REPLACEMENT_FOR", "Terephthalate plasticiser used to replace DEHP. No score is transferred."],
  ["melatonin", "paraquat", "PROTECTS_AGAINST", "Experimental reports of reduced oxidative and mitochondrial neuronal injury. Not a demonstrated clinical antidote."],
  ["glyphosate-based-herbicide", "glyphosate", "CONTAINS", "The formulation shell contains glyphosate. Findings on the formulation are not copied onto the active ingredient."],
  ["glyphosate", "glyphosate-based-herbicide", "ACTIVE_INGREDIENT_OF", "Glyphosate is an active ingredient of the formulation shell. The formulation is not scored as glyphosate."],
] as const;

export const metabolicTransformations = [
  {
    stableKey: "ddt-to-dde",
    parentSlug: "ddt",
    productSlug: "dde",
    transformationType: "dehydrochlorination",
    activeMetabolite: null as boolean | null,
    reactiveMetabolite: null as boolean | null,
    toxicologicallyRelevant: false,
    summary: "p,p'-DDE is a persistent metabolite and breakdown product of DDT.",
  },
  {
    stableKey: "mancozeb-to-etu",
    parentSlug: "mancozeb",
    productSlug: "etu",
    transformationType: "breakdown",
    activeMetabolite: null as boolean | null,
    reactiveMetabolite: null as boolean | null,
    toxicologicallyRelevant: true,
    summary: "Ethylenethiourea is a thyroid-relevant breakdown product of mancozeb, stored as its own compound.",
  },
  {
    stableKey: "risperidone-to-paliperidone",
    parentSlug: "risperidone",
    productSlug: "paliperidone",
    transformationType: "hydroxylation",
    activeMetabolite: true,
    reactiveMetabolite: null as boolean | null,
    toxicologicallyRelevant: false,
    summary: "Paliperidone is 9-hydroxyrisperidone, the active metabolite of risperidone.",
  },
  {
    stableKey: "prednisone-to-prednisolone",
    parentSlug: "prednisone",
    productSlug: "prednisolone",
    transformationType: "activation",
    activeMetabolite: true,
    reactiveMetabolite: null as boolean | null,
    toxicologicallyRelevant: false,
    summary: "Prednisone is a prodrug. Prednisolone is the active glucocorticoid.",
  },
  {
    stableKey: "lisdexamfetamine-to-dexamphetamine",
    parentSlug: "lisdexamfetamine",
    productSlug: "dexamphetamine",
    transformationType: "activation",
    activeMetabolite: true,
    reactiveMetabolite: null as boolean | null,
    toxicologicallyRelevant: false,
    summary: "Lisdexamfetamine is a prodrug of dextroamphetamine.",
  },
];

export const interactions = [
  {
    stableKey: "melatonin-paraquat-redox",
    compoundASlug: "melatonin",
    compoundBSlug: "paraquat",
    interactionType: "PROTECTS_AGAINST" as const,
    domainCode: "REDOX_CELLULAR_STRESS",
    mechanismCode: "ROS_TOTAL",
    effectScore: -3 as number | null,
    confidence: "LOW" as const,
    humanRelevance: "H1" as const,
    exposureContextKey: "experimental-toxicant-stress",
    biologicalContextKey: "dopaminergic-neuron",
    summary:
      "Experimental models report less oxidative and mitochondrial neuronal injury when melatonin is present with paraquat. This is not demonstrated clinical benefit.",
    limitations:
      "Animal and cellular protection does not establish a treatment effect in humans. Dose, timing, and formulation are not curated.",
  },
];

export const dataGaps = [
  ["melatonin-puberty", "melatonin", "PUBERTY_TIMING", "DEVELOPMENTAL_ENDOCRINOLOGY", "HIGH", "DEVELOPMENTAL_RELEVANCE_UNCERTAIN", "Long-term childhood melatonin use and puberty timing are insufficiently demonstrated.", "Prospective paediatric studies with pubertal endpoints, dose, and duration."],
  ["melatonin-dev-redox", "melatonin", "ROS_TOTAL", "REDOX_CELLULAR_STRESS", "MODERATE", "INSUFFICIENT_HUMAN_EVIDENCE", "Developmental redox signalling of melatonin is not distinguished from adult experimental protection.", "Developmental models that separate physiological circadian signalling from toxicant co-exposure."],
  ["mph-mito-therapeutic", "methylphenidate", "ATP_PRODUCTION", "MITOCHONDRIAL_BIOENERGETICS", "HIGH", "DOSE_RELEVANCE_UNCERTAIN", "Therapeutic-dose human mitochondrial relevance is uncertain. Experimental scores must not be read as the clinical growth effect.", "Studies at therapeutic CNS concentrations with pre-registered mitochondrial endpoints."],
  ["sdhi-human", "boscalid", "ETC_COMPLEX_II", "MITOCHONDRIAL_BIOENERGETICS", "HIGH", "INSUFFICIENT_HUMAN_EVIDENCE", "SDHI complex II potency is mechanistic. Human relevance at environmental exposure is currently low.", "Biomonitoring linked to mitochondrial biomarkers, not fungal efficacy data."],
  ["tfa-human-causal", "tfa", "THYROID_HORMONE", "NEUROENDOCRINE_HPA_CIRCADIAN", "HIGH", "INSUFFICIENT_HUMAN_EVIDENCE", "Thyroid developmental concern is not established human causation, and TFA is not a classical estrogen.", "Human studies of thyroid hormones and neurodevelopment at measured TFA exposure."],
  ["fluoxetine-er", "fluoxetine", "ER_ALPHA_AGONISM", "REPRODUCTIVE_ENDOCRINOLOGY", "MODERATE", "CONFLICTING_EVIDENCE", "Estrogen-receptor and steroidogenic findings are context-dependent and conflict.", "Experiments that pre-specify tissue, sex, dose, and direction before claiming receptor activity."],
  ["dinch-gap", "dinch", null, "REPRODUCTIVE_ENDOCRINOLOGY", "HIGH", "NOT_YET_CURATED", "Replacement plasticiser. No score is copied from DEHP.", "Curate DINCH on androgen, steroidogenic, and metabolic endpoints before any comparison score."],
  ["deht-gap", "deht", null, "REPRODUCTIVE_ENDOCRINOLOGY", "HIGH", "NOT_YET_CURATED", "Replacement plasticiser. No score is copied from DEHP.", "Curate DEHT/DEHTP independently of DEHP."],
  ["atbc-gap", "atbc", null, "REPRODUCTIVE_ENDOCRINOLOGY", "MODERATE", "NOT_YET_CURATED", "Replacement plasticiser without a seeded score.", "Independent endocrine and metabolic curation."],
  ["short-pfas-gap", "representative-short-chain-pfas", null, "IMMUNOLOGY_IMMUNOENDOCRINOLOGY", "HIGH", "NOT_YET_CURATED", "Short-chain PFAS are not assumed to match the PFOS profile.", "Compound-specific immune and developmental evidence."],
  ["replacement-pfas-gap", "representative-replacement-pfas", null, "DEVELOPMENTAL_ENDOCRINOLOGY", "HIGH", "NOT_YET_CURATED", "Replacement PFAS are not scored from legacy long-chain data.", "HFPO-DA-specific human and developmental evidence."],
  ["chlorpyrifos-gap", "chlorpyrifos", "NEURODEVELOPMENT", "DEVELOPMENTAL_ENDOCRINOLOGY", "HIGH", "NOT_YET_CURATED", "Developmental neurotoxicity literature is not curated in this phase, so no score is invented.", "Curate human and developmental animal findings before assigning DEV or NEUROENDO."],
  ["bpa-replacements", "bps", null, "REPRODUCTIVE_ENDOCRINOLOGY", "HIGH", "NOT_YET_CURATED", "BPS is a replacement analogue. BPA's scores are not transferred.", "Side-by-side curation against BPA on the same endpoints."],
] as const;

export const evidenceSources = [
  {
    stableKey: "phase1-structural-seed-not-a-publication",
    title: "Phase 1 structural seed record (not a publication)",
    authors: null as string | null,
    journalOrPublisher: "EDCtox seed corpus",
    year: 2026,
    sourceType: "MECHANISTIC_REVIEW" as const,
    peerReviewed: false,
    countsAsScientificEvidence: false,
    notes:
      "This row exists so one source can support more than one finding without being duplicated. It is not a paper, DOI, or citation. Do not cite it. Replace it with curated literature.",
  },
];

export const evidenceFindings = [
  {
    stableKey: "bpa-er-alpha-structural-finding",
    sourceKey: "phase1-structural-seed-not-a-publication",
    compoundSlug: "bpa",
    mechanismCode: "ER_ALPHA_AGONISM",
    assessmentKey: "default",
    species: "Not applicable",
    sex: "NOT_APPLICABLE" as const,
    studyQuality: "NOT_ASSESSED" as const,
    studyDesign: "MECHANISTIC_SUMMARY" as const,
    evidenceClass: "MECHANISTIC_REVIEW" as const,
    doseMetricType: "UNKNOWN" as const,
    doseText: "Not a study dose",
    durationText: "Not a study duration",
    findingSummary: "Structural example: one source row can point at the BPA estrogen-receptor assessment.",
    effectDirection: "DISRUPTIVE" as const,
    ourInterpretation: "Not scientific evidence. Present only to prove the source/finding split.",
    limitations: "Placeholder. Excluded from finding counts because the source is marked as non-evidence.",
    relevanceScore: 0,
  },
  {
    stableKey: "bpa-insulin-structural-finding",
    sourceKey: "phase1-structural-seed-not-a-publication",
    compoundSlug: "bpa",
    mechanismCode: "INSULIN_RESISTANCE",
    assessmentKey: "default",
    species: "Not applicable",
    sex: "NOT_APPLICABLE" as const,
    studyQuality: "NOT_ASSESSED" as const,
    studyDesign: "MECHANISTIC_SUMMARY" as const,
    evidenceClass: "MECHANISTIC_REVIEW" as const,
    doseMetricType: "UNKNOWN" as const,
    doseText: "Not a study dose",
    durationText: "Not a study duration",
    findingSummary: "Structural example: the same source row also points at the BPA insulin-resistance assessment.",
    effectDirection: "DISRUPTIVE" as const,
    ourInterpretation: "Same publication record, second finding. The source is not duplicated.",
    limitations: "Placeholder. Excluded from finding counts.",
    relevanceScore: 0,
  },
];
