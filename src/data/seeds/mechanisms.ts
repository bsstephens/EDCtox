import type { DomainCode } from "./domains";
import { gutVascularMechanisms } from "./gutVascularMechanisms";

export type ScorePolicy = "SCORABLE" | "RESEARCH_ONLY" | "GROUPING_ONLY";

export type MechanismSeed = {
  code: string;
  domainCode: DomainCode;
  name: string;
  description: string;
  parentCode?: string;
  aggregationGroup: string;
  scorePolicy: ScorePolicy;
  sortOrder: number;
  familyCode?: string;
  quantitativeScoreByDefault?: boolean;
};

type Row = {
  code: string;
  name: string;
  group: string;
  parent?: string;
  policy?: ScorePolicy;
  description?: string;
};

const descriptions: Record<string, string> = {
  REORGANIZATION_ENERGY:
    "Marcus reorganization energy is a research field for electron-transfer theory. It must not be scored from ATP, oxygen consumption, or other indirect bioenergetic changes.",
  MELATONIN_MT1:
    "MT1 receptor signalling. High activity of the endogenous ligand is physiological and is not a toxicity score.",
  MELATONIN_MT2:
    "MT2 receptor signalling. High activity of the endogenous ligand is physiological and is not a toxicity score.",
  ETC_COMPLEX_II:
    "Succinate dehydrogenase / complex II. SDHI fungicides act here in the target organism. Mammalian human relevance is a separate field.",
  ETC_COMPLEX_I:
    "NADH:ubiquinone oxidoreductase. Rotenone and some redox-cycling toxicants act here. Do not infer complex II effects from complex I data.",
  THYROID_HORMONE:
    "Circulating and tissue thyroid hormone signalling. Added so thyroid-active compounds are not forced into an estrogen-receptor mechanism.",
  THYROID_RECEPTOR:
    "Thyroid hormone receptor signalling. Distinct from estrogen and androgen receptors.",
  TSH: "Thyrotropin signalling. Distinct from gonadotropins.",
  ER_ALPHA_AGONISM:
    "Estrogen receptor alpha agonism or activation. A binding or reporter result is not itself a human disease claim.",
  PROLACTIN:
    "Prolactin secretion and signalling. Antipsychotic D2 antagonism can raise prolactin; that pharmacology is not the same as a metabolic effect.",
  INSULIN_RESISTANCE:
    "Impaired insulin action at target tissues. A mechanistic insulin-signalling change is not automatically a diagnosis of diabetes.",
  CO_FORMULANT_CONTEXT:
    "Formulation co-formulants can change exposure or toxicity. Parent-compound assessments must not silently include them.",
};

function block(domainCode: DomainCode, rows: Row[]): MechanismSeed[] {
  return rows.map((row, index) => ({
    code: row.code,
    domainCode,
    name: row.name,
    description:
      row.description ??
      descriptions[row.code] ??
      `${row.name}. Mechanism node for evidence linkage. A row here is not itself a finding.`,
    parentCode: row.parent,
    aggregationGroup: row.group,
    scorePolicy: row.policy ?? "SCORABLE",
    sortOrder: index,
  }));
}

const grouping = (code: string, name: string, group: string): Row => ({
  code,
  name,
  group,
  policy: "GROUPING_ONLY",
  description: `${name}. Organizational parent. Not scored.`,
});

export const mechanisms: MechanismSeed[] = [
  ...block("REPRODUCTIVE_ENDOCRINOLOGY", [
    grouping("REP_ESTROGEN_RECEPTOR", "Estrogen receptor axis", "REP_ESTROGEN_RECEPTOR"),
    grouping("REP_ANDROGEN_RECEPTOR", "Androgen receptor axis", "REP_ANDROGEN_RECEPTOR"),
    grouping("REP_STEROIDOGENESIS", "Steroidogenic enzymes", "REP_STEROIDOGENESIS"),
    grouping("REP_HPG", "Hypothalamic–pituitary–gonadal axis", "REP_HPG"),
    grouping("REP_GONADAL", "Gonadal function", "REP_GONADAL"),
    { code: "ER_ALPHA_AGONISM", name: "ER-alpha agonism", group: "ESTROGEN_RECEPTOR", parent: "REP_ESTROGEN_RECEPTOR" },
    { code: "ER_ALPHA_ANTAGONISM", name: "ER-alpha antagonism", group: "ESTROGEN_RECEPTOR", parent: "REP_ESTROGEN_RECEPTOR" },
    { code: "ER_BETA_AGONISM", name: "ER-beta agonism", group: "ESTROGEN_RECEPTOR", parent: "REP_ESTROGEN_RECEPTOR" },
    { code: "ER_BETA_ANTAGONISM", name: "ER-beta antagonism", group: "ESTROGEN_RECEPTOR", parent: "REP_ESTROGEN_RECEPTOR" },
    { code: "GPER_SIGNALING", name: "GPER signalling", group: "ESTROGEN_RECEPTOR", parent: "REP_ESTROGEN_RECEPTOR" },
    { code: "ANDROGEN_RECEPTOR_AGONISM", name: "Androgen receptor agonism", group: "ANDROGEN_RECEPTOR", parent: "REP_ANDROGEN_RECEPTOR" },
    { code: "ANDROGEN_RECEPTOR_ANTAGONISM", name: "Androgen receptor antagonism", group: "ANDROGEN_RECEPTOR", parent: "REP_ANDROGEN_RECEPTOR" },
    { code: "PROGESTERONE_RECEPTOR", name: "Progesterone receptor", group: "PROGESTERONE_SIGNALING", parent: "REP_STEROIDOGENESIS" },
    { code: "AROMATASE_CYP19A1", name: "Aromatase (CYP19A1)", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "STAR", name: "StAR", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "CYP11A1", name: "CYP11A1", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "CYP17A1", name: "CYP17A1", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "HSD3B", name: "3β-HSD", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "HSD17B", name: "17β-HSD", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "GNRH", name: "GnRH", group: "HPG_AXIS", parent: "REP_HPG" },
    { code: "KISSPEPTIN", name: "Kisspeptin", group: "HPG_AXIS", parent: "REP_HPG" },
    { code: "GNIH", name: "GnIH", group: "HPG_AXIS", parent: "REP_HPG" },
    { code: "LH", name: "LH", group: "HPG_AXIS", parent: "REP_HPG" },
    { code: "FSH", name: "FSH", group: "HPG_AXIS", parent: "REP_HPG" },
    { code: "PROLACTIN", name: "Prolactin", group: "HPG_AXIS", parent: "REP_HPG" },
    { code: "TESTOSTERONE", name: "Testosterone", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "ESTRADIOL", name: "Estradiol", group: "STEROIDOGENESIS", parent: "REP_STEROIDOGENESIS" },
    { code: "PROGESTERONE", name: "Progesterone", group: "PROGESTERONE_SIGNALING", parent: "REP_STEROIDOGENESIS" },
    { code: "DHT", name: "DHT", group: "ANDROGEN_RECEPTOR", parent: "REP_ANDROGEN_RECEPTOR" },
    { code: "SPERMATOGENESIS", name: "Spermatogenesis", group: "GONADAL_FUNCTION", parent: "REP_GONADAL" },
    { code: "OOGENESIS", name: "Oogenesis", group: "GONADAL_FUNCTION", parent: "REP_GONADAL" },
    { code: "OVARIAN_FOLLICLE_RESERVE", name: "Ovarian follicle reserve", group: "GONADAL_FUNCTION", parent: "REP_GONADAL" },
    { code: "OVULATION", name: "Ovulation", group: "GONADAL_FUNCTION", parent: "REP_GONADAL" },
    { code: "FERTILITY", name: "Fertility", group: "GONADAL_FUNCTION", parent: "REP_GONADAL" },
    { code: "SEXUAL_DIFFERENTIATION", name: "Sexual differentiation", group: "GONADAL_FUNCTION", parent: "REP_GONADAL" },
  ]),
  ...block("DEVELOPMENTAL_ENDOCRINOLOGY", [
    grouping("DEV_PLACENTA", "Placenta", "DEV_PLACENTA"),
    grouping("DEV_FETAL_GONAD", "Fetal gonad", "DEV_FETAL_GONAD"),
    grouping("DEV_DIFFERENTIATION", "Developmental differentiation", "DEV_DIFFERENTIATION"),
    grouping("DEV_PUBERTY_GROWTH", "Puberty and growth", "DEV_PUBERTY_GROWTH"),
    grouping("DEV_EPIGENETIC", "Developmental programming", "DEV_EPIGENETIC"),
    { code: "PLACENTAL_SIGNALING", name: "Placental signalling", group: "PLACENTA", parent: "DEV_PLACENTA" },
    { code: "PLACENTAL_STEROIDOGENESIS", name: "Placental steroidogenesis", group: "PLACENTA", parent: "DEV_PLACENTA" },
    { code: "FETAL_GONAD", name: "Fetal gonad", group: "FETAL_GONAD", parent: "DEV_FETAL_GONAD" },
    { code: "FETAL_LEYDIG_CELL", name: "Fetal Leydig cell", group: "FETAL_GONAD", parent: "DEV_FETAL_GONAD" },
    { code: "FETAL_OVARY", name: "Fetal ovary", group: "FETAL_OVARY", parent: "DEV_FETAL_GONAD" },
    { code: "ANOGENITAL_DISTANCE", name: "Anogenital distance", group: "DEVELOPMENTAL_MORPHOLOGY", parent: "DEV_DIFFERENTIATION" },
    { code: "BRAIN_SEXUAL_DIFFERENTIATION", name: "Brain sexual differentiation", group: "DEVELOPMENTAL_MORPHOLOGY", parent: "DEV_DIFFERENTIATION" },
    { code: "THYROID_DEPENDENT_BRAIN_DEVELOPMENT", name: "Thyroid-dependent brain development", group: "THYROID_DEVELOPMENT", parent: "DEV_DIFFERENTIATION" },
    { code: "NEURODEVELOPMENT", name: "Neurodevelopment", group: "NEURODEVELOPMENT", parent: "DEV_DIFFERENTIATION" },
    { code: "PUBERTY_TIMING", name: "Puberty timing", group: "PUBERTY", parent: "DEV_PUBERTY_GROWTH" },
    { code: "MENARCHE", name: "Menarche", group: "PUBERTY", parent: "DEV_PUBERTY_GROWTH" },
    { code: "GROWTH", name: "Growth", group: "GROWTH", parent: "DEV_PUBERTY_GROWTH" },
    { code: "EPIGENETIC_PROGRAMMING", name: "Epigenetic programming", group: "EPIGENETIC_PROGRAMMING", parent: "DEV_EPIGENETIC" },
    { code: "GERMLINE_EPIGENETICS", name: "Germline epigenetics", group: "EPIGENETIC_PROGRAMMING", parent: "DEV_EPIGENETIC" },
    { code: "TRANSGENERATIONAL_SIGNAL", name: "Transgenerational signal", group: "EPIGENETIC_PROGRAMMING", parent: "DEV_EPIGENETIC" },
    { code: "DEVELOPMENTAL_METABOLIC_PROGRAMMING", name: "Developmental metabolic programming", group: "DEVELOPMENTAL_PROGRAMMING", parent: "DEV_EPIGENETIC" },
    { code: "DEVELOPMENTAL_IMMUNE_PROGRAMMING", name: "Developmental immune programming", group: "DEVELOPMENTAL_PROGRAMMING", parent: "DEV_EPIGENETIC" },
  ]),
  ...block("NEUROENDOCRINE_HPA_CIRCADIAN", [
    grouping("NEU_HPA", "HPA axis", "NEU_HPA"),
    grouping("NEU_MELATONIN", "Melatonin receptors", "NEU_MELATONIN"),
    grouping("NEU_CIRCADIAN", "Circadian timing", "NEU_CIRCADIAN"),
    grouping("NEU_THYROID", "Thyroid axis", "NEU_THYROID"),
    { code: "CRH", name: "CRH", group: "HPA", parent: "NEU_HPA" },
    { code: "ACTH", name: "ACTH", group: "HPA", parent: "NEU_HPA" },
    { code: "CORTISOL", name: "Cortisol", group: "HPA", parent: "NEU_HPA" },
    { code: "GLUCOCORTICOID_RECEPTOR", name: "Glucocorticoid receptor", group: "GLUCOCORTICOID_RECEPTOR", parent: "NEU_HPA" },
    { code: "HPA_AXIS", name: "HPA axis", group: "HPA", parent: "NEU_HPA" },
    { code: "SYMPATHETIC_SIGNALING", name: "Sympathetic signalling", group: "SYMPATHETIC", parent: "NEU_HPA" },
    { code: "DOPAMINE", name: "Dopamine", group: "DOPAMINE", parent: "NEU_HPA" },
    { code: "SEROTONIN", name: "Serotonin", group: "SEROTONIN", parent: "NEU_HPA" },
    { code: "NOREPINEPHRINE", name: "Norepinephrine", group: "NOREPINEPHRINE", parent: "NEU_HPA" },
    { code: "MELATONIN_MT1", name: "Melatonin MT1", group: "MELATONIN_RECEPTOR", parent: "NEU_MELATONIN" },
    { code: "MELATONIN_MT2", name: "Melatonin MT2", group: "MELATONIN_RECEPTOR", parent: "NEU_MELATONIN" },
    { code: "CIRCADIAN_PHASE", name: "Circadian phase", group: "CIRCADIAN", parent: "NEU_CIRCADIAN" },
    { code: "SLEEP_WAKE_SIGNALING", name: "Sleep–wake signalling", group: "CIRCADIAN", parent: "NEU_CIRCADIAN" },
    { code: "SCN_SIGNALING", name: "SCN signalling", group: "CIRCADIAN", parent: "NEU_CIRCADIAN" },
    { code: "APPETITE_HYPOTHALAMUS", name: "Hypothalamic appetite signalling", group: "APPETITE", parent: "NEU_CIRCADIAN" },
    { code: "LEPTIN_SIGNALING", name: "Leptin signalling", group: "APPETITE", parent: "NEU_CIRCADIAN" },
    { code: "GH_IGF1_AXIS", name: "GH–IGF-1 axis", group: "GH_IGF1", parent: "NEU_HPA" },
    { code: "TSH", name: "TSH", group: "THYROID_AXIS", parent: "NEU_THYROID" },
    { code: "THYROID_HORMONE", name: "Thyroid hormone (T4/T3)", group: "THYROID_AXIS", parent: "NEU_THYROID" },
    { code: "THYROID_RECEPTOR", name: "Thyroid hormone receptor", group: "THYROID_AXIS", parent: "NEU_THYROID" },
  ]),
  ...block("IMMUNOLOGY_IMMUNOENDOCRINOLOGY", [
    grouping("IMM_ADAPTIVE", "Adaptive immunity", "IMM_ADAPTIVE"),
    grouping("IMM_INNATE", "Innate immunity and cytokines", "IMM_INNATE"),
    { code: "ANTIBODY_RESPONSE", name: "Antibody response", group: "ANTIBODY_RESPONSE", parent: "IMM_ADAPTIVE" },
    { code: "VACCINE_RESPONSE", name: "Vaccine response", group: "ANTIBODY_RESPONSE", parent: "IMM_ADAPTIVE" },
    { code: "B_CELL_FUNCTION", name: "B-cell function", group: "ANTIBODY_RESPONSE", parent: "IMM_ADAPTIVE" },
    { code: "T_CELL_FUNCTION", name: "T-cell function", group: "T_CELL", parent: "IMM_ADAPTIVE" },
    { code: "TREG_TH17_BALANCE", name: "Treg / Th17 balance", group: "T_CELL", parent: "IMM_ADAPTIVE" },
    { code: "NK_CELL_FUNCTION", name: "NK-cell function", group: "INNATE_CELLS", parent: "IMM_INNATE" },
    { code: "MACROPHAGE_POLARIZATION", name: "Macrophage polarization", group: "INNATE_CELLS", parent: "IMM_INNATE" },
    { code: "CYTOKINE_SIGNALING", name: "Cytokine signalling", group: "CYTOKINE_INFLAMMATION", parent: "IMM_INNATE" },
    { code: "TNF_ALPHA", name: "TNF-alpha", group: "CYTOKINE_INFLAMMATION", parent: "IMM_INNATE" },
    { code: "IL6", name: "IL-6", group: "CYTOKINE_INFLAMMATION", parent: "IMM_INNATE" },
    { code: "NFKB", name: "NF-κB", group: "CYTOKINE_INFLAMMATION", parent: "IMM_INNATE" },
    { code: "INFLAMMASOME", name: "Inflammasome", group: "CYTOKINE_INFLAMMATION", parent: "IMM_INNATE" },
    { code: "AUTOIMMUNITY", name: "Autoimmunity", group: "AUTOIMMUNITY", parent: "IMM_ADAPTIVE" },
    { code: "IMMUNE_SUPPRESSION", name: "Immune suppression", group: "IMMUNE_SUPPRESSION", parent: "IMM_ADAPTIVE" },
    { code: "IMMUNE_ACTIVATION", name: "Immune activation", group: "CYTOKINE_INFLAMMATION", parent: "IMM_INNATE" },
    { code: "DEVELOPMENTAL_IMMUNOTOXICITY", name: "Developmental immunotoxicity", group: "DEVELOPMENTAL_IMMUNOTOXICITY", parent: "IMM_ADAPTIVE" },
  ]),
  ...block("SYSTEMIC_METABOLISM", [
    grouping("MET_INSULIN_SIGNALING", "Insulin signalling pathway", "MET_INSULIN_SIGNALING"),
    grouping("MET_LIPID", "Lipid handling", "MET_LIPID"),
    { code: "INSULIN_SECRETION", name: "Insulin secretion", group: "INSULIN_SECRETION", parent: "MET_INSULIN_SIGNALING" },
    { code: "BETA_CELL_FUNCTION", name: "Beta-cell function", group: "INSULIN_SECRETION", parent: "MET_INSULIN_SIGNALING" },
    { code: "FASTING_INSULIN", name: "Fasting insulin", group: "INSULIN_SECRETION", parent: "MET_INSULIN_SIGNALING" },
    { code: "HYPERINSULINEMIA", name: "Hyperinsulinemia", group: "INSULIN_SECRETION", parent: "MET_INSULIN_SIGNALING" },
    { code: "INSULIN_RESISTANCE", name: "Insulin resistance", group: "INSULIN_SIGNALING", parent: "MET_INSULIN_SIGNALING" },
    { code: "INSULIN_RECEPTOR", name: "Insulin receptor", group: "INSULIN_SIGNALING", parent: "MET_INSULIN_SIGNALING" },
    { code: "IRS1", name: "IRS1", group: "INSULIN_SIGNALING", parent: "MET_INSULIN_SIGNALING" },
    { code: "IRS2", name: "IRS2", group: "INSULIN_SIGNALING", parent: "MET_INSULIN_SIGNALING" },
    { code: "PI3K", name: "PI3K", group: "INSULIN_SIGNALING", parent: "MET_INSULIN_SIGNALING" },
    { code: "AKT", name: "AKT", group: "INSULIN_SIGNALING", parent: "MET_INSULIN_SIGNALING" },
    { code: "GLUT4", name: "GLUT4", group: "INSULIN_SIGNALING", parent: "MET_INSULIN_SIGNALING" },
    { code: "GLUT2", name: "GLUT2", group: "SUBSTRATE_OXIDATION", parent: "MET_INSULIN_SIGNALING" },
    { code: "HEPATIC_GLUCOSE_PRODUCTION", name: "Hepatic glucose production", group: "HEPATIC_GLUCOSE", parent: "MET_INSULIN_SIGNALING" },
    { code: "FOXO1", name: "FOXO1", group: "HEPATIC_GLUCOSE", parent: "MET_INSULIN_SIGNALING" },
    { code: "PEPCK", name: "PEPCK", group: "HEPATIC_GLUCOSE", parent: "MET_INSULIN_SIGNALING" },
    { code: "G6PASE", name: "Glucose-6-phosphatase", group: "HEPATIC_GLUCOSE", parent: "MET_INSULIN_SIGNALING" },
    { code: "GLYCOGEN_METABOLISM", name: "Glycogen metabolism", group: "HEPATIC_GLUCOSE", parent: "MET_INSULIN_SIGNALING" },
    { code: "GLYCOLYSIS", name: "Glycolysis", group: "SUBSTRATE_OXIDATION", parent: "MET_INSULIN_SIGNALING" },
    { code: "TCA_CYCLE", name: "TCA cycle", group: "SUBSTRATE_OXIDATION", parent: "MET_INSULIN_SIGNALING" },
    { code: "LIPOLYSIS", name: "Lipolysis", group: "SUBSTRATE_OXIDATION", parent: "MET_LIPID" },
    { code: "LIPOGENESIS", name: "Lipogenesis", group: "NUCLEAR_RECEPTOR_LIPID", parent: "MET_LIPID" },
    { code: "SREBP", name: "SREBP", group: "NUCLEAR_RECEPTOR_LIPID", parent: "MET_LIPID" },
    { code: "PPAR_ALPHA", name: "PPAR-alpha", group: "NUCLEAR_RECEPTOR_LIPID", parent: "MET_LIPID" },
    { code: "PPAR_GAMMA", name: "PPAR-gamma", group: "NUCLEAR_RECEPTOR_LIPID", parent: "MET_LIPID" },
    { code: "RXR", name: "RXR", group: "NUCLEAR_RECEPTOR_LIPID", parent: "MET_LIPID" },
    { code: "ADIPOGENESIS", name: "Adipogenesis", group: "NUCLEAR_RECEPTOR_LIPID", parent: "MET_LIPID" },
    { code: "ADIPOCYTE_DIFFERENTIATION", name: "Adipocyte differentiation", group: "NUCLEAR_RECEPTOR_LIPID", parent: "MET_LIPID" },
    { code: "LEPTIN", name: "Leptin", group: "ADIPOKINES", parent: "MET_LIPID" },
    { code: "ADIPONECTIN", name: "Adiponectin", group: "ADIPOKINES", parent: "MET_LIPID" },
    { code: "FATTY_ACID_OXIDATION", name: "Fatty acid oxidation", group: "SUBSTRATE_OXIDATION", parent: "MET_LIPID" },
    { code: "DAG", name: "Diacylglycerol", group: "ECTOPIC_LIPID", parent: "MET_LIPID" },
    { code: "CERAMIDE", name: "Ceramide", group: "ECTOPIC_LIPID", parent: "MET_LIPID" },
    { code: "ECTOPIC_LIPID", name: "Ectopic lipid", group: "ECTOPIC_LIPID", parent: "MET_LIPID" },
    { code: "HEPATIC_STEATOSIS", name: "Hepatic steatosis", group: "ECTOPIC_LIPID", parent: "MET_LIPID" },
    { code: "GLUCOSE_TOLERANCE", name: "Glucose tolerance", group: "GLUCOSE_TOLERANCE", parent: "MET_INSULIN_SIGNALING" },
  ]),
  ...block("MITOCHONDRIAL_BIOENERGETICS", [
    grouping("MIT_ETC", "Electron transport complexes", "MIT_ETC"),
    grouping("MIT_OUTPUT", "Bioenergetic output", "MIT_OUTPUT"),
    grouping("MIT_DYNAMICS", "Mitochondrial dynamics", "MIT_DYNAMICS"),
    { code: "ETC_COMPLEX_I", name: "ETC complex I", group: "ETC_COMPLEX_I", parent: "MIT_ETC" },
    { code: "ETC_COMPLEX_II", name: "ETC complex II", group: "ETC_COMPLEX_II", parent: "MIT_ETC" },
    { code: "ETC_COMPLEX_III", name: "ETC complex III", group: "ETC_COMPLEX_III", parent: "MIT_ETC" },
    { code: "ETC_COMPLEX_IV", name: "ETC complex IV", group: "ETC_COMPLEX_IV", parent: "MIT_ETC" },
    { code: "ATP_SYNTHASE", name: "ATP synthase", group: "ATP_SYNTHASE", parent: "MIT_ETC" },
    { code: "ETC_FLUX", name: "ETC flux", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "ELECTRON_TRANSFER_RATE", name: "Electron transfer rate", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "ELECTRON_LEAK", name: "Electron leak", group: "ELECTRON_LEAK", parent: "MIT_OUTPUT" },
    { code: "ELECTRON_TRANSFER_COUPLING", name: "Electron-transfer coupling", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    {
      code: "REORGANIZATION_ENERGY",
      name: "Reorganization energy",
      group: "REORGANIZATION_ENERGY",
      parent: "MIT_OUTPUT",
      policy: "RESEARCH_ONLY",
    },
    { code: "MEMBRANE_POTENTIAL", name: "Membrane potential", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "PROTON_GRADIENT", name: "Proton gradient", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "PROTON_LEAK", name: "Proton leak", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "COUPLING_EFFICIENCY", name: "Coupling efficiency", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "OXYGEN_CONSUMPTION", name: "Oxygen consumption", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "ATP_PRODUCTION", name: "ATP production", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "CO2_PRODUCTION", name: "CO2 production", group: "BIOENERGETIC_OUTPUT", parent: "MIT_OUTPUT" },
    { code: "NADH_NAD_RATIO", name: "NADH/NAD ratio", group: "REDOX_COFACTORS", parent: "MIT_OUTPUT" },
    { code: "FADH2_METABOLISM", name: "FADH2 metabolism", group: "REDOX_COFACTORS", parent: "MIT_OUTPUT" },
    { code: "SUCCINATE", name: "Succinate", group: "ETC_COMPLEX_II", parent: "MIT_ETC" },
    { code: "FUMARATE", name: "Fumarate", group: "ETC_COMPLEX_II", parent: "MIT_ETC" },
    { code: "BETA_OXIDATION", name: "Mitochondrial beta-oxidation", group: "BETA_OXIDATION", parent: "MIT_OUTPUT" },
    { code: "MITOCHONDRIAL_BIOGENESIS", name: "Mitochondrial biogenesis", group: "MITOCHONDRIAL_DYNAMICS", parent: "MIT_DYNAMICS" },
    { code: "PGC1_ALPHA", name: "PGC-1α", group: "MITOCHONDRIAL_DYNAMICS", parent: "MIT_DYNAMICS" },
    { code: "MITOCHONDRIAL_FISSION", name: "Mitochondrial fission", group: "MITOCHONDRIAL_DYNAMICS", parent: "MIT_DYNAMICS" },
    { code: "MITOCHONDRIAL_FUSION", name: "Mitochondrial fusion", group: "MITOCHONDRIAL_DYNAMICS", parent: "MIT_DYNAMICS" },
    { code: "MITOPHAGY", name: "Mitophagy", group: "MITOCHONDRIAL_DYNAMICS", parent: "MIT_DYNAMICS" },
    { code: "MITOCHONDRIAL_TRANSPORT", name: "Mitochondrial transport", group: "MITOCHONDRIAL_DYNAMICS", parent: "MIT_DYNAMICS" },
    { code: "MITOCHONDRIAL_CALCIUM", name: "Mitochondrial calcium", group: "MITOCHONDRIAL_DYNAMICS", parent: "MIT_DYNAMICS" },
  ]),
  ...block("REDOX_CELLULAR_STRESS", [
    grouping("RED_ROS", "Reactive species", "RED_ROS"),
    grouping("RED_ANTIOXIDANT", "Antioxidant systems", "RED_ANTIOXIDANT"),
    grouping("RED_DAMAGE", "Oxidative damage", "RED_DAMAGE"),
    { code: "SUPEROXIDE", name: "Superoxide", group: "ROS_GENERATION", parent: "RED_ROS" },
    { code: "HYDROGEN_PEROXIDE", name: "Hydrogen peroxide", group: "ROS_GENERATION", parent: "RED_ROS" },
    { code: "HYDROXYL_RADICAL", name: "Hydroxyl radical", group: "ROS_GENERATION", parent: "RED_ROS" },
    { code: "ROS_TOTAL", name: "ROS (total)", group: "ROS_GENERATION", parent: "RED_ROS" },
    { code: "RNS", name: "Reactive nitrogen species", group: "RNS", parent: "RED_ROS" },
    { code: "NITRIC_OXIDE", name: "Nitric oxide", group: "RNS", parent: "RED_ROS" },
    { code: "REDOX_SIGNALING", name: "Redox signalling", group: "REDOX_SIGNALING", parent: "RED_ROS" },
    { code: "MITOHORMESIS", name: "Mitohormesis", group: "REDOX_SIGNALING", parent: "RED_ROS" },
    { code: "GLUTATHIONE", name: "Glutathione", group: "ANTIOXIDANT_SYSTEM", parent: "RED_ANTIOXIDANT" },
    { code: "GSH_GSSG", name: "GSH/GSSG", group: "ANTIOXIDANT_SYSTEM", parent: "RED_ANTIOXIDANT" },
    { code: "SOD", name: "Superoxide dismutase", group: "ANTIOXIDANT_SYSTEM", parent: "RED_ANTIOXIDANT" },
    { code: "CATALASE", name: "Catalase", group: "ANTIOXIDANT_SYSTEM", parent: "RED_ANTIOXIDANT" },
    { code: "GLUTATHIONE_PEROXIDASE", name: "Glutathione peroxidase", group: "ANTIOXIDANT_SYSTEM", parent: "RED_ANTIOXIDANT" },
    { code: "NRF2", name: "NRF2", group: "ANTIOXIDANT_SYSTEM", parent: "RED_ANTIOXIDANT" },
    { code: "KEAP1", name: "KEAP1", group: "ANTIOXIDANT_SYSTEM", parent: "RED_ANTIOXIDANT" },
    { code: "SIRTUIN", name: "Sirtuins", group: "SIRTUIN", parent: "RED_ANTIOXIDANT" },
    { code: "LIPID_PEROXIDATION", name: "Lipid peroxidation", group: "OXIDATIVE_DAMAGE", parent: "RED_DAMAGE" },
    { code: "PROTEIN_OXIDATION", name: "Protein oxidation", group: "OXIDATIVE_DAMAGE", parent: "RED_DAMAGE" },
    { code: "DNA_OXIDATION", name: "DNA oxidation", group: "OXIDATIVE_DAMAGE", parent: "RED_DAMAGE" },
    { code: "8_OHDG", name: "8-OHdG", group: "OXIDATIVE_DAMAGE", parent: "RED_DAMAGE" },
    { code: "DOPAMINE_QUINONE", name: "Dopamine quinone", group: "REACTIVE_METABOLITES", parent: "RED_DAMAGE" },
    { code: "REACTIVE_METABOLITES", name: "Reactive metabolites", group: "REACTIVE_METABOLITES", parent: "RED_DAMAGE" },
    { code: "ER_STRESS", name: "ER stress", group: "ER_STRESS", parent: "RED_DAMAGE" },
    { code: "UNFOLDED_PROTEIN_RESPONSE", name: "Unfolded protein response", group: "ER_STRESS", parent: "RED_DAMAGE" },
    { code: "JNK", name: "JNK", group: "STRESS_KINASE", parent: "RED_DAMAGE" },
    { code: "IKKB", name: "IKKβ", group: "STRESS_KINASE", parent: "RED_DAMAGE" },
    { code: "APOPTOSIS", name: "Apoptosis", group: "CELL_DEATH", parent: "RED_DAMAGE" },
    { code: "FERROPTOSIS", name: "Ferroptosis", group: "CELL_DEATH", parent: "RED_DAMAGE" },
    { code: "AUTOPHAGY", name: "Autophagy", group: "CELL_DEATH", parent: "RED_DAMAGE" },
    { code: "OXIDATIVE_DAMAGE", name: "Oxidative damage", group: "OXIDATIVE_DAMAGE", parent: "RED_DAMAGE" },
  ]),
  ...block("EXPOSURE_DEVELOPMENTAL_MODIFIERS", [
    grouping("EXP_CONTEXT", "Exposure context", "EXP_CONTEXT"),
    { code: "DEVELOPMENTAL_WINDOW_CONTEXT", name: "Developmental window", group: "EXPOSURE_CONTEXT", parent: "EXP_CONTEXT", policy: "GROUPING_ONLY" },
    { code: "CO_FORMULANT_CONTEXT", name: "Co-formulant context", group: "EXPOSURE_CONTEXT", parent: "EXP_CONTEXT", policy: "GROUPING_ONLY" },
    { code: "MIXTURE_CONTEXT", name: "Mixture context", group: "EXPOSURE_CONTEXT", parent: "EXP_CONTEXT", policy: "GROUPING_ONLY" },
    { code: "THERAPEUTIC_VERSUS_ENVIRONMENTAL", name: "Therapeutic versus environmental dose", group: "EXPOSURE_CONTEXT", parent: "EXP_CONTEXT", policy: "GROUPING_ONLY" },
  ]),
  ...gutVascularMechanisms,
];

const codes = new Set<string>();
for (const mechanism of mechanisms) {
  if (codes.has(mechanism.code)) {
    throw new Error(`Duplicate mechanism code: ${mechanism.code}`);
  }
  codes.add(mechanism.code);
}
