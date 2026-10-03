export const domains = [
  {
    code: "REPRODUCTIVE_ENDOCRINOLOGY",
    shortLabel: "REP",
    name: "Reproductive endocrinology",
    description:
      "Steroid receptors, steroidogenesis, the hypothalamic–pituitary–gonadal axis, and gonadal function.",
    contributesToProfile: true,
    sortOrder: 1,
  },
  {
    code: "DEVELOPMENTAL_ENDOCRINOLOGY",
    shortLabel: "DEV",
    name: "Developmental endocrinology",
    description:
      "Placental, fetal, pubertal, and programming mechanisms. Developmental toxicity that is not endocrine is still recorded here when that is the honest description, and the text says so.",
    contributesToProfile: true,
    sortOrder: 2,
  },
  {
    code: "NEUROENDOCRINE_HPA_CIRCADIAN",
    shortLabel: "NEUROENDO",
    name: "Neuroendocrine, HPA, and circadian",
    description:
      "Hypothalamic–pituitary–adrenal signalling, monoamines, melatonin receptors, circadian timing, appetite, growth hormone, and thyroid hormone signalling.",
    contributesToProfile: true,
    sortOrder: 3,
  },
  {
    code: "IMMUNOLOGY_IMMUNOENDOCRINOLOGY",
    shortLabel: "IMM",
    name: "Immunology and immunoendocrinology",
    description:
      "Adaptive and innate immune function, cytokines, and immune effects that depend on endocrine context.",
    contributesToProfile: true,
    sortOrder: 4,
  },
  {
    code: "SYSTEMIC_METABOLISM",
    shortLabel: "MET",
    name: "Systemic metabolism",
    description:
      "Insulin secretion and signalling, hepatic glucose production, lipid handling, and adipokines.",
    contributesToProfile: true,
    sortOrder: 5,
  },
  {
    code: "MITOCHONDRIAL_BIOENERGETICS",
    shortLabel: "MITO",
    name: "Mitochondrial bioenergetics",
    description:
      "Electron transport, ATP synthesis, membrane energetics, and mitochondrial dynamics. Reorganization energy is a research field and is not scored from ATP or oxygen changes.",
    contributesToProfile: true,
    sortOrder: 6,
  },
  {
    code: "REDOX_CELLULAR_STRESS",
    shortLabel: "REDOX",
    name: "Redox and cellular stress",
    description:
      "Reactive oxygen and nitrogen species, antioxidant systems, oxidative damage, and stress-response pathways.",
    contributesToProfile: true,
    sortOrder: 7,
  },
  {
    code: "EXPOSURE_DEVELOPMENTAL_MODIFIERS",
    shortLabel: "EXPOSURE",
    name: "Exposure and developmental modifiers",
    description:
      "Contextual modifiers: co-formulants, mixtures, therapeutic versus environmental dose, and developmental window. This domain does not contribute a profile score and is never added to mechanistic domains.",
    contributesToProfile: false,
    sortOrder: 8,
  },
  {
    code: "VASCULAR_ENDOTHELIAL",
    shortLabel: "VASCULAR",
    name: "Vascular and endothelial",
    description:
      "Nitric oxide and vascular tone, endothelial barrier, angiogenesis, haemostasis, and microvascular function. Stored so those mechanisms are not forced into an immune or redox headline. This domain does not contribute a profile column.",
    contributesToProfile: false,
    sortOrder: 9,
  },
] as const;

export type DomainCode = (typeof domains)[number]["code"];
export type DomainShortLabel = (typeof domains)[number]["shortLabel"];
