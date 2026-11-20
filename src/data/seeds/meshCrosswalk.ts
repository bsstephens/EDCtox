/**
 * MeSH descriptor to EDCtox ontology. Layer 2 of docs/SCREENING_REDESIGN.md.
 *
 * A hand-built, version-controlled crosswalk, deliberately incomplete. It covers the descriptors
 * that appear in the stored corpus plus obvious neighbours. A descriptor that is in neither table
 * below is reported as an ontology gap rather than silently dropped, which is how the ontology
 * learns what it is missing.
 *
 * Two rules keep it honest.
 *
 * A descriptor maps to a **domain** freely. A domain is a place to look, not a claim.
 *
 * A descriptor maps to an **outcome** only when the outcome is a diagnosis rather than a
 * direction. MeSH names the endpoint, "Sperm Count"; the EDCtox outcome names a direction,
 * "Reduced sperm count". Mapping one to the other would invent a direction the paper may never
 * have reported. So endpoints route to a domain and stop there, and a curator or a later
 * extraction decides direction.
 */

import { type DomainShortLabel } from "./domains";

/** Descriptor to the profile domain it bears on. */
export const MESH_DOMAIN: Record<string, DomainShortLabel> = {
  // Reproductive
  Reproduction: "REP",
  "Reproductive Health": "REP",
  "Polycystic Ovary Syndrome": "REP",
  Endometriosis: "REP",
  Infertility: "REP",
  "Infertility, Female": "REP",
  "Infertility, Male": "REP",
  Fertility: "REP",
  Spermatozoa: "REP",
  "Sperm Count": "REP",
  "Sperm Motility": "REP",
  Spermatogenesis: "REP",
  "Semen Analysis": "REP",
  Semen: "REP",
  Testis: "REP",
  Ovary: "REP",
  "Ovarian Reserve": "REP",
  "Ovarian Follicle": "REP",
  "Granulosa Cells": "REP",
  Testosterone: "REP",
  Estradiol: "REP",
  Progesterone: "REP",
  "Anti-Mullerian Hormone": "REP",
  "Estrogen Receptor alpha": "REP",
  "Estrogen Receptor beta": "REP",
  "Receptors, Estrogen": "REP",
  "Receptors, Androgen": "REP",
  Aromatase: "REP",
  "Luteinizing Hormone": "REP",
  "Follicle Stimulating Hormone": "REP",
  "Menstrual Cycle": "REP",
  "Embryo Implantation": "REP",
  "Fertilization in Vitro": "REP",
  "Uterus": "REP",
  "Leiomyoma": "REP",
  "Erectile Dysfunction": "REP",
  "Sexual Maturation": "REP",
  // Hormone-related cancers route through the mechanism domain that bears on them. There is no
  // cancer column by design, so this is a place to look for the biology, never a score for the
  // tumour. Without a domain these fell through to the gap list and their outcome was unused.
  //
  // Adding a cancer takes three edits and no migration: an outcome in outcomes.ts with category
  // CANCER, a descriptor here pointing at the mechanism domain that bears on it, and the same
  // descriptor in MESH_OUTCOME below. The routing tests then enforce that the three agree.
  "Breast Neoplasms": "REP",
  "Prostatic Neoplasms": "REP",
  "Endometrial Neoplasms": "REP",
  "Ovarian Neoplasms": "REP",
  "Carcinoma, Ovarian Epithelial": "REP",

  // Developmental
  Pregnancy: "DEV",
  "Pregnancy Outcome": "DEV",
  "Maternal Exposure": "DEV",
  "Paternal Exposure": "DEV",
  "Prenatal Exposure Delayed Effects": "DEV",
  "Birth Weight": "DEV",
  "Infant, Low Birth Weight": "DEV",
  "Premature Birth": "DEV",
  "Fetal Development": "DEV",
  "Embryonic Development": "DEV",
  Puberty: "DEV",
  "Puberty, Precocious": "DEV",
  Menarche: "DEV",
  "Child Development": "DEV",
  "Epigenesis, Genetic": "DEV",
  "Cryptorchidism": "DEV",
  "Hypospadias": "DEV",
  "Fetal Growth Retardation": "DEV",
  "Neurodevelopmental Disorders": "DEV",

  // Thyroid
  "Thyroid Gland": "THY",
  "Thyroid Hormones": "THY",
  Thyroxine: "THY",
  Triiodothyronine: "THY",
  Thyrotropin: "THY",
  Hypothyroidism: "THY",
  "Thyroid Diseases": "THY",
  "Receptors, Thyroid Hormone": "THY",
  "Thyroid Neoplasms": "THY",

  // Neuroendocrine
  "Hypothalamo-Hypophyseal System": "NEUROENDO",
  "Pituitary-Adrenal System": "NEUROENDO",
  Hydrocortisone: "NEUROENDO",
  Corticosterone: "NEUROENDO",
  Melatonin: "NEUROENDO",
  "Circadian Rhythm": "NEUROENDO",
  Prolactin: "NEUROENDO",
  Dopamine: "NEUROENDO",
  Serotonin: "NEUROENDO",
  Leptin: "NEUROENDO",

  // Immune
  "Immune System": "IMM",
  "Immunity, Innate": "IMM",
  Cytokines: "IMM",
  Inflammation: "IMM",
  Asthma: "IMM",
  Hypersensitivity: "IMM",
  "Autoimmune Diseases": "IMM",
  "Antibody Formation": "IMM",
  "T-Lymphocytes": "IMM",
  "B-Lymphocytes": "IMM",
  "NF-kappa B": "IMM",

  // Metabolic
  "Insulin Resistance": "MET",
  "Diabetes Mellitus, Type 2": "MET",
  Obesity: "MET",
  "Metabolic Diseases": "MET",
  "Metabolic Syndrome": "MET",
  Insulin: "MET",
  Adipogenesis: "MET",
  Adipocytes: "MET",
  "Lipid Metabolism": "MET",
  "Fatty Liver": "MET",
  "Non-alcoholic Fatty Liver Disease": "MET",
  "Glucose Intolerance": "MET",
  "Blood Glucose": "MET",
  "Weight Gain": "MET",

  // Mitochondrial
  Mitochondria: "MITO",
  "Electron Transport": "MITO",
  "Adenosine Triphosphate": "MITO",
  "Membrane Potential, Mitochondrial": "MITO",
  "Oxidative Phosphorylation": "MITO",

  // Redox and cellular stress
  "Oxidative Stress": "REDOX",
  "Reactive Oxygen Species": "REDOX",
  Antioxidants: "REDOX",
  Apoptosis: "REDOX",
  Autophagy: "REDOX",
  "DNA Damage": "REDOX",
  "Cell Survival": "REDOX",
  "Cell Proliferation": "REDOX",
  "Lipid Peroxidation": "REDOX",
  Glutathione: "REDOX",
  "Superoxide Dismutase": "REDOX",
  Ferroptosis: "REDOX",
  "Endoplasmic Reticulum Stress": "REDOX",

  // Vascular, stored and outside the headline columns
  "Cardiovascular Diseases": "VASCULAR",
  Hypertension: "VASCULAR",
  Endothelium: "VASCULAR",
  "Endothelium, Vascular": "VASCULAR",
  Atherosclerosis: "VASCULAR",
  "Nitric Oxide": "VASCULAR",

  // Exposure context, stored and outside the headline columns
  "Environmental Exposure": "EXPOSURE",
  "Maternal-Fetal Exchange": "EXPOSURE",
  "Occupational Exposure": "EXPOSURE",
  "Dietary Exposure": "EXPOSURE",
  "Food Contamination": "EXPOSURE",
  "Gastrointestinal Microbiome": "EXPOSURE",
};

/**
 * Descriptor to an EDCtox outcome, only where the outcome is a diagnosis and carries no
 * direction of its own. An endpoint such as "Sperm Count" is deliberately absent: routing it to
 * "Reduced sperm count" would assert a direction the paper may not have reported.
 */
export const MESH_OUTCOME: Record<string, string> = {
  "Polycystic Ovary Syndrome": "PCOS",
  Endometriosis: "ENDOMETRIOSIS",
  Leiomyoma: "UTERINE_FIBROIDS",
  Infertility: "INFERTILITY",
  "Infertility, Female": "INFERTILITY",
  "Infertility, Male": "INFERTILITY",
  "Diabetes Mellitus, Type 2": "TYPE_2_DIABETES",
  "Insulin Resistance": "INSULIN_RESISTANCE",
  Hypothyroidism: "HYPOTHYROIDISM",
  Cryptorchidism: "CRYPTORCHIDISM",
  Hypospadias: "HYPOSPADIAS",
  "Infant, Low Birth Weight": "LOW_BIRTH_WEIGHT",
  "Premature Birth": "PRETERM_BIRTH",
  Asthma: "ASTHMA",
  Hypertension: "HYPERTENSION",
  "Breast Neoplasms": "BREAST_CANCER",
  "Prostatic Neoplasms": "PROSTATE_CANCER",
  "Thyroid Neoplasms": "THYROID_CANCER",
  "Endometrial Neoplasms": "ENDOMETRIAL_CANCER",
  "Ovarian Neoplasms": "OVARIAN_CANCER",
  "Carcinoma, Ovarian Epithelial": "OVARIAN_CANCER",
};

/**
 * Descriptors that are real indexing but say nothing about which biological domain a paper bears
 * on: study design, demographics, geography, methods, statistics, and chemical identity, which is
 * handled separately through the substance headings.
 *
 * Listing them matters. Without this, every one would surface as an ontology gap and the real
 * gaps would be lost in the noise.
 */
export const MESH_NOT_A_DOMAIN = new Set([
  // Demographics and population
  "Humans", "Animals", "Male", "Female", "Adult", "Young Adult", "Middle Aged", "Aged",
  "Adolescent", "Child", "Child, Preschool", "Infant", "Infant, Newborn", "Pregnant Women",
  "Aged, 80 and over", "Adult, Young", "Maternal Age", "Paternal Age", "Ethnicity",
  "Sex Factors", "Age Factors", "Mothers", "Fathers",
  // Model organisms
  "Mice", "Rats", "Rats, Sprague-Dawley", "Rats, Wistar", "Mice, Inbred C57BL", "Zebrafish",
  "Swine", "Cattle", "Rabbits", "Drosophila melanogaster", "Caenorhabditis elegans",
  "Daphnia", "Copepoda", "Fishes", "Oryzias",
  // Study design and statistics
  "Cross-Sectional Studies", "Cohort Studies", "Prospective Studies", "Retrospective Studies",
  "Case-Control Studies", "Longitudinal Studies", "Risk Factors", "Risk Assessment",
  "Odds Ratio", "Logistic Models", "Regression Analysis", "Meta-Analysis as Topic",
  "Randomized Controlled Trials as Topic", "Reproducibility of Results", "Sample Size",
  "Confidence Intervals", "Publication Bias", "Bias", "Research Design",
  // Methods and materials
  "Cells, Cultured", "Cell Line", "Cell Line, Tumor", "Epithelial Cells", "Biological Assay",
  "Gas Chromatography-Mass Spectrometry", "Chromatography, High Pressure Liquid",
  "Solid Phase Extraction", "Mass Spectrometry", "Computer Simulation",
  "Molecular Docking Simulation", "Molecular Dynamics Simulation", "Toxicity Tests",
  "Dose-Response Relationship, Drug", "Environmental Monitoring", "Limit of Detection",
  "Gene Expression Regulation", "Signal Transduction", "Molecular Structure",
  "Structure-Activity Relationship", "Models, Molecular", "Transcriptome", "Proteomics",
  // Exposure vocabulary that names no biology
  "Endocrine Disruptors", "Environmental Pollutants", "Water Pollutants, Chemical",
  "Air Pollutants", "Air Pollutants, Occupational", "Xenobiotics", "Hazardous Substances",
  "Carcinogens", "Biomarkers", "Teratogens", "Plastics", "Microplastics", "Plasticizers",
  "Beverages", "Food Packaging", "Consumer Product Safety",
  // Geography and administration
  "Boston", "United States", "China", "Europe", "Denmark", "Japan", "Korea", "Taiwan",
  "Public Health", "Government Regulation", "Environmental Policy",
]);

/**
 * Chemical class terms, and the class placeholder record each one belongs to.
 *
 * A paper about phthalates as a class is not a paper about DEHP. So a class term may match a
 * record whose kind is CLASS_PLACEHOLDER and may never match a specific compound, however close
 * the names look. A class term with no placeholder stays unmatched and is reported as such,
 * which is a different and more actionable signal than an unrecognised chemical name.
 */
export const CLASS_TERM_PLACEHOLDER: Record<string, string | null> = {
  // Terms with a placeholder record.
  microplastics: "micro-nanoplastics",
  nanoplastics: "micro-nanoplastics",
  "micro and nanoplastics": "micro-nanoplastics",
  "microplastics and nanoplastics": "micro-nanoplastics",
  parabens: "parabens",
  pcbs: "pcbs",
  "polychlorinated biphenyls": "pcbs",
  dioxins: "dioxin-like-compounds",
  "dioxin like compounds": "dioxin-like-compounds",
  benzophenones: "benzophenone-uv-filters",
  "benzophenone uv filters": "benzophenone-uv-filters",
  "uv filters": "benzophenone-uv-filters",

  // Terms the corpus uses that have no placeholder record yet. Listing them here is what turns
  // "an unrecognised chemical" into "a class this database has nowhere to put".
  phthalates: null,
  "phthalate esters": null,
  bisphenols: null,
  "bisphenol analogues": null,
  "bpa analogs": null,
  "bpa analogues": null,
  pfas: null,
  "per and polyfluoroalkyl substances": null,
  "perfluoroalkyl substances": null,
  pesticides: null,
  "organophosphate pesticides": null,
  "organochlorine pesticides": null,
  "flame retardants": null,
  "brominated flame retardants": null,
  "heavy metals": null,
  "endocrine disrupting chemicals": null,
  "endocrine disruptors": null,
  edcs: null,
  "persistent organic pollutants": null,
  "alkylphenols": null,
};
