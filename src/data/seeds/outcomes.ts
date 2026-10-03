export const outcomes = [
  ["DELAYED_PUBERTY", "Delayed puberty", "DEVELOPMENTAL", "Later pubertal onset. Not inferred from a receptor assay."],
  ["EARLY_PUBERTY", "Early puberty", "DEVELOPMENTAL", "Earlier pubertal onset."],
  ["DELAYED_MENARCHE", "Delayed menarche", "DEVELOPMENTAL", "Later menarche."],
  ["REDUCED_ANOGENITAL_DISTANCE", "Reduced anogenital distance", "DEVELOPMENTAL", "Shorter anogenital distance. A morphological outcome, not itself a receptor mechanism."],
  ["REDUCED_TESTOSTERONE", "Reduced testosterone", "REPRODUCTIVE", "Lower testosterone. Direction is stored on the assessment, not implied by the outcome name alone when evidence is mixed."],
  ["HYPERPROLACTINEMIA", "Hyperprolactinemia", "REPRODUCTIVE", "Raised prolactin. Established pharmacology for some antipsychotics; not a metabolic outcome."],
  ["HYPOGONADISM", "Hypogonadism", "REPRODUCTIVE", "Clinically low gonadal function."],
  ["PCOS", "Polycystic ovary syndrome", "REPRODUCTIVE", "PCOS phenotype. Association is not automatic causation."],
  ["ANOVULATION", "Anovulation", "REPRODUCTIVE", "Absent or impaired ovulation."],
  ["REDUCED_SPERM_COUNT", "Reduced sperm count", "REPRODUCTIVE", "Lower sperm concentration or count."],
  ["REDUCED_SPERM_MOTILITY", "Reduced sperm motility", "REPRODUCTIVE", "Lower sperm motility."],
  ["INFERTILITY", "Infertility", "REPRODUCTIVE", "Clinical infertility. Requires outcome-level evidence."],
  ["HYPOTHYROIDISM", "Hypothyroidism", "NEUROENDOCRINE", "Clinically low thyroid function."],
  ["REDUCED_T4", "Reduced T4", "NEUROENDOCRINE", "Lower thyroxine. Not an estrogenic outcome."],
  ["ALTERED_TSH", "Altered TSH", "NEUROENDOCRINE", "TSH change in either direction. The assessment records direction."],
  ["INSULIN_RESISTANCE", "Insulin resistance", "METABOLIC", "Clinical or biochemical insulin resistance. Distinct from the insulin-signalling mechanism row."],
  ["HYPERINSULINEMIA", "Hyperinsulinemia", "METABOLIC", "Raised insulin."],
  ["IMPAIRED_GLUCOSE_TOLERANCE", "Impaired glucose tolerance", "METABOLIC", "Impaired glucose tolerance."],
  ["TYPE_2_DIABETES", "Type 2 diabetes", "METABOLIC", "Diabetes diagnosis. Not inferred from a single signalling node."],
  ["WEIGHT_GAIN", "Weight gain", "METABOLIC", "Increased body weight."],
  ["ADIPOSITY", "Adiposity", "METABOLIC", "Increased fat mass."],
  ["HEPATIC_STEATOSIS", "Hepatic steatosis", "METABOLIC", "Liver fat accumulation."],
  ["REDUCED_ANTIBODY_RESPONSE", "Reduced antibody response", "IMMUNE", "Lower antibody response, including vaccine response where that is the measured outcome."],
  ["NEUROINFLAMMATION", "Neuroinflammation", "IMMUNE", "Inflammatory change in neural tissue."],
  ["MITOCHONDRIAL_DYSFUNCTION", "Mitochondrial dysfunction", "MITOCHONDRIAL", "Observed bioenergetic impairment. Not a claim about reorganization energy."],
  ["ATP_DEPLETION", "ATP depletion", "MITOCHONDRIAL", "Lower ATP. Not used to infer Marcus reorganization energy."],
  ["OXIDATIVE_DAMAGE", "Oxidative damage", "REDOX", "Measured oxidative damage to lipids, protein, or DNA."],
  ["LIPID_PEROXIDATION", "Lipid peroxidation", "REDOX", "Lipid peroxidation products."],
  ["NEURONAL_DEATH", "Neuronal death", "REDOX", "Neuronal loss or death."],
  ["NEURODEVELOPMENTAL_CHANGE", "Neurodevelopmental change", "DEVELOPMENTAL", "Change in neurodevelopment. May be endocrine or non-endocrine; the assessment text has to say which."],
  ["REDUCED_APPETITE", "Reduced appetite", "NEUROENDOCRINE", "Lower appetite or caloric intake. Clinical pharmacology for some stimulants; not a mitochondrial outcome."],
  ["REDUCED_LINEAR_GROWTH", "Reduced linear growth", "DEVELOPMENTAL", "Slower height gain. Kept separate from experimental mitochondrial injury."],
  ["INCREASED_INTESTINAL_PERMEABILITY", "Increased intestinal permeability", "GASTROINTESTINAL", "Outcome-level barrier failure. Unscored until curated. Not inferred from a tight-junction mechanism name."],
  ["GUT_BARRIER_DYSFUNCTION", "Gut barrier dysfunction", "GASTROINTESTINAL", "Clinical or phenotypic barrier dysfunction. Unscored placeholder."],
  ["MICROBIAL_DYSBIOSIS", "Microbial dysbiosis", "GASTROINTESTINAL", "An outcome label only. A diversity change does not fill this in. Unscored placeholder."],
  ["ALTERED_SCFA_PROFILE", "Altered SCFA profile", "GASTROINTESTINAL", "A change in short-chain fatty acids as an outcome. Direction is not implied. Unscored placeholder."],
  ["ENDOTOXEMIA", "Endotoxemia", "GASTROINTESTINAL", "Outcome-level endotoxemia. Distinct from the LPS mechanism. Unscored placeholder."],
  ["ENDOTHELIAL_DYSFUNCTION", "Endothelial dysfunction", "VASCULAR", "Phenotypic endothelial dysfunction. An ICAM-1 or eNOS change does not fill this in. Unscored placeholder."],
  ["MICROVASCULAR_DYSFUNCTION", "Microvascular dysfunction", "VASCULAR", "Phenotypic microvascular dysfunction. Unscored placeholder."],
  ["IMPAIRED_VASODILATION", "Impaired vasodilation", "VASCULAR", "Reduced vasodilator response as an outcome. Unscored placeholder."],
  ["THROMBOTIC_EVENT", "Thrombotic event", "VASCULAR", "A clinical thrombotic event. Distinct from coagulation as a mechanism. Unscored placeholder."],
  ["VASCULAR_INFLAMMATION", "Vascular inflammation", "VASCULAR", "Outcome-level vascular inflammation. Distinct from the vascular-inflammation mechanism. Unscored placeholder."],
] as const;

export type OutcomeSeed = {
  code: string;
  name: string;
  category: (typeof outcomes)[number][2];
  description: string;
};

export const outcomeSeeds: OutcomeSeed[] = outcomes.map(([code, name, category, description]) => ({
  code,
  name,
  category,
  description,
}));
